// app/api/brokerage/sync/route.ts
//
// POST /api/brokerage/sync
//   body: { force?: boolean }
// Syncs all of the current user's brokerage connections. Skips any that
// are <15 min fresh unless force=true.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncBrokerageConnection } from "@/lib/snaptrade-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!process.env.SNAPTRADE_CLIENT_ID || !process.env.SNAPTRADE_CONSUMER_SECRET) {
    return NextResponse.json(
      { error: "SnapTrade is not configured." },
      { status: 500 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const force = !!body?.force;

  // Credentials live ON brokerage_connections itself.
  // Only sync 'active' connections (skip 'pending' or disabled rows).
  const { data: connections, error: connErr } = await supabase
    .from("brokerage_connections")
    .select("id, authorization_id, snaptrade_user_id, snaptrade_user_secret, status")
    .eq("user_id", user.id);

  if (connErr) {
    console.warn("brokerage/sync: select failed:", connErr.message);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
  if (!connections || connections.length === 0) {
    return NextResponse.json({ synced: [] });
  }

  const results: any[] = [];
  for (const c of connections) {
    if (c.status !== "active") {
      results.push({ connectionId: c.id, ok: false, skipped: true, reason: `status=${c.status}` });
      continue;
    }
    if (!c.snaptrade_user_id || !c.snaptrade_user_secret || !c.authorization_id) {
      results.push({
        connectionId: c.id,
        ok: false,
        error: "missing snaptrade credentials on connection row",
      });
      continue;
    }

    try {
      const r = await syncBrokerageConnection({
        supabase,
        userId: user.id,
        snaptradeUserId: c.snaptrade_user_id,
        snaptradeUserSecret: c.snaptrade_user_secret,
        connectionId: c.id,
        authorizationId: c.authorization_id,
        force,
      });
      results.push({ connectionId: c.id, ok: true, ...r });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "sync failed";
      console.error("brokerage/sync: failed", c.id, msg);
      results.push({ connectionId: c.id, ok: false, error: msg });
    }
  }

  return NextResponse.json({ synced: results });
}