// lib/portfolio/brokerage.ts
//
// Server-side fetchers for brokerage data. Reads from brokerage_positions
// and brokerage_connections under the user's RLS scope.

import { createClient } from "@/lib/supabase/server";

export type BrokeragePosition = {
  id: string;
  account_name: string | null;
  symbol: string;
  description: string | null;
  quantity: number;
  avg_cost: number | null;
  market_value: number | null;
  current_price: number | null;
  currency: string;
  last_synced_at: string;
};

export type BrokerageData = {
  positions: BrokeragePosition[];
  hasActiveConnections: boolean;
};

export async function getBrokerageData(): Promise<BrokerageData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { positions: [], hasActiveConnections: false };

  const [positionsRes, connectionsRes] = await Promise.all([
    supabase
      .from("brokerage_positions")
      .select(
        "id, account_name, symbol, description, quantity, avg_cost, market_value, current_price, currency, last_synced_at",
      )
      .eq("user_id", user.id)
      .order("market_value", { ascending: false, nullsFirst: false }),
    supabase
      .from("brokerage_connections")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "active"),
  ]);

  if (positionsRes.error) {
    console.warn("getBrokerageData positions:", positionsRes.error.message);
  }
  if (connectionsRes.error) {
    console.warn("getBrokerageData connections:", connectionsRes.error.message);
  }

  return {
    positions: (positionsRes.data ?? []) as BrokeragePosition[],
    hasActiveConnections: (connectionsRes.count ?? 0) > 0,
  };
}