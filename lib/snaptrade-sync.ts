// lib/snaptrade-sync.ts
//
// Pulls positions + activities for a single brokerage_connections row.
// - Positions: wiped + refilled per account on every sync (snapshot model).
// - Activities: upserted, deduped by (user_id, snaptrade_activity_id).
// - Equities only: filters by symbol type code. Non-equities are logged + skipped.

import type { SupabaseClient } from "@supabase/supabase-js";
import { snaptrade } from "@/lib/snaptrade/client";

const STALE_MS = 15 * 60 * 1000; // 15 min

// SnapTrade symbol type codes — conservative for now.
// cs = common stock, et = ETF, ad = ADR, ps = preferred stock
const EQUITY_TYPE_CODES = new Set(["cs", "et", "ad", "ps"]);

type SyncOpts = {
  supabase: SupabaseClient;       // user-scoped client from the route
  userId: string;                 // Supabase auth.users.id
  snaptradeUserId: string;
  snaptradeUserSecret: string;
  connectionId: string;           // brokerage_connections.id (our PK)
  authorizationId: string;        // SnapTrade's authorization id
  force?: boolean;                // bypass 15-min freshness gate
};

export type SyncResult = {
  skipped: boolean;
  reason?: string;
  positionsInserted?: number;
  activitiesInserted?: number;
  nonEquityFiltered?: { positions: number; activities: number };
};

export async function syncBrokerageConnection(opts: SyncOpts): Promise<SyncResult> {
  const { supabase } = opts;

  // 1) Freshness gate
  if (!opts.force) {
    const { data: conn } = await supabase
      .from("brokerage_connections")
      .select("last_synced_at")
      .eq("id", opts.connectionId)
      .single();
    if (
      conn?.last_synced_at &&
      Date.now() - new Date(conn.last_synced_at).getTime() < STALE_MS
    ) {
      return { skipped: true, reason: "fresh" };
    }
  }

  // 2) List accounts under this SnapTrade authorization
  const accountsRes = await snaptrade.connections.listBrokerageAuthorizationAccounts({
    authorizationId: opts.authorizationId,
    userId: opts.snaptradeUserId,
    userSecret: opts.snaptradeUserSecret,
  });
  const accounts = ((accountsRes as any).data ?? []) as any[];

  let positionsInserted = 0;
  let activitiesInserted = 0;
  const nonEquity = { positions: 0, activities: 0 };

  for (const acct of accounts) {
    const accountId: string = acct.id;
    const accountName: string =
      acct.name ?? acct.institution_name ?? "Account";

    // ---- POSITIONS ----
    const posRes = await snaptrade.accountInformation.getUserAccountPositions({
      userId: opts.snaptradeUserId,
      userSecret: opts.snaptradeUserSecret,
      accountId,
    });
    const positions: any[] = (posRes as any).data ?? [];

    // Wipe + refill for this account
    await supabase
      .from("brokerage_positions")
      .delete()
      .eq("connection_id", opts.connectionId)
      .eq("account_id", accountId);

    const positionRows = positions
      .filter((p) => {
        const typeCode =
          p?.symbol?.symbol?.type?.code ?? p?.symbol?.type?.code;
        const ok = typeCode && EQUITY_TYPE_CODES.has(typeCode);
        if (!ok) nonEquity.positions++;
        return ok;
      })
      .map((p) => {
        const sym = p?.symbol?.symbol ?? p?.symbol ?? {};
        const ticker = sym.symbol ?? sym.raw_symbol ?? "UNKNOWN";
        const price = Number(p.price ?? 0);
        const units = Number(p.units ?? 0);
        return {
          user_id: opts.userId,
          connection_id: opts.connectionId,
          account_id: accountId,
          account_name: accountName,
          symbol: ticker,
          description: sym.description ?? null,
          quantity: units,
          avg_cost: p.average_purchase_price ?? null,
          market_value: units * price,
          current_price: price || null,
          currency: sym?.currency?.code ?? "USD",
          last_synced_at: new Date().toISOString(),
        };
      });

    if (positionRows.length > 0) {
      const { error } = await supabase
        .from("brokerage_positions")
        .insert(positionRows);
      if (error) throw new Error(`positions insert: ${error.message}`);
      positionsInserted += positionRows.length;
    }

    // ---- ACTIVITIES ----
    let offset = 0;
    const pageSize = 1000;
    const maxPages = 10; // safety cap
    let page = 0;

    while (page < maxPages) {
      const actRes = await snaptrade.accountInformation.getAccountActivities({
        accountId,
        userId: opts.snaptradeUserId,
        userSecret: opts.snaptradeUserSecret,
        offset,
        limit: pageSize,
        type: "BUY,SELL,DIVIDEND",
      } as any);

      // Node SDK may return { data: [...] } or { data: { data: [...] } }
      const raw = (actRes as any).data;
      const activities: any[] = Array.isArray(raw) ? raw : raw?.data ?? [];
      if (activities.length === 0) break;

      const activityRows = activities
        .filter((a) => {
          if (a.type === "DIVIDEND") return true;
          const typeCode =
            a?.symbol?.type?.code ?? a?.symbol?.symbol?.type?.code;
          const ok = typeCode && EQUITY_TYPE_CODES.has(typeCode);
          if (!ok) nonEquity.activities++;
          return ok;
        })
        .map((a) => {
          const sym = a?.symbol?.symbol ?? a?.symbol ?? {};
          return {
            user_id: opts.userId,
            connection_id: opts.connectionId,
            account_id: accountId,
            snaptrade_activity_id: a.id,
            symbol: sym.symbol ?? sym.raw_symbol ?? null,
            description: a.description ?? sym.description ?? null,
            type: a.type,
            quantity: a.units ?? null,
            price: a.price ?? null,
            amount: a.amount ?? null,
            fee: a.fee ?? 0,
            currency: a?.currency?.code ?? "USD",
            trade_date: a.trade_date ?? null,
            settlement_date: a.settlement_date ?? null,
          };
        });

      if (activityRows.length > 0) {
        const { error } = await supabase
          .from("brokerage_activities")
          .upsert(activityRows, {
            onConflict: "user_id,snaptrade_activity_id",
            ignoreDuplicates: true,
          });
        if (error) throw new Error(`activities upsert: ${error.message}`);
        activitiesInserted += activityRows.length;
      }

      if (activities.length < pageSize) break;
      offset += pageSize;
      page++;
    }
  }

  // 3) Stamp last_synced_at on the connection
  await supabase
    .from("brokerage_connections")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", opts.connectionId);

  return {
    skipped: false,
    positionsInserted,
    activitiesInserted,
    nonEquityFiltered: nonEquity,
  };
}