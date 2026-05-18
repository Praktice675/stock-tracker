import { NextResponse } from "next/server";
import { fetchYahooQuote } from "@/lib/yahooFinance";
import { createClient } from "@/lib/supabase/server";

// Snapshots are per-user time-series points used by IntradayPortfolioChart.
// POST computes the current total brokerage value from the freshest Yahoo
// quote per symbol and inserts a row. GET returns the last 24h of points
// in chronological order.

type PositionRow = {
  symbol: string | null;
  quantity: number | null;
};

type SnapshotRow = {
  total_value: number | string;
  taken_at: string;
};

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: positions, error: posErr } = await supabase
    .from("brokerage_positions")
    .select("symbol, quantity")
    .eq("user_id", user.id);

  if (posErr) {
    return NextResponse.json(
      { error: `Positions read failed: ${posErr.message}` },
      { status: 500 },
    );
  }

  const rows = (positions ?? []) as PositionRow[];
  const uniqueSymbols = Array.from(
    new Set(
      rows
        .map((p) => p.symbol)
        .filter((s): s is string => typeof s === "string" && s.length > 0),
    ),
  );

  // Parallel fetch with the bulk-style helper. Each unique symbol hits
  // Yahoo once; missing prices are skipped (the position contributes 0
  // rather than NaN, so a single bad ticker doesn't void the snapshot).
  const priceEntries = await Promise.all(
    uniqueSymbols.map(async (sym) => {
      const q = await fetchYahooQuote(sym);
      return [sym, q?.price ?? null] as const;
    }),
  );
  const priceMap = new Map<string, number>();
  for (const [sym, price] of priceEntries) {
    if (typeof price === "number" && Number.isFinite(price)) {
      priceMap.set(sym, price);
    }
  }

  let totalValue = 0;
  for (const p of rows) {
    if (!p.symbol || typeof p.quantity !== "number") continue;
    const price = priceMap.get(p.symbol);
    if (typeof price !== "number") continue;
    totalValue += p.quantity * price;
  }

  const { data: inserted, error: insErr } = await supabase
    .from("portfolio_snapshots")
    .insert({ user_id: user.id, total_value: totalValue })
    .select("total_value, taken_at")
    .single();

  if (insErr) {
    return NextResponse.json(
      { error: `Snapshot insert failed: ${insErr.message}` },
      { status: 500 },
    );
  }

  const row = inserted as SnapshotRow;
  return NextResponse.json({
    totalValue: Number(row.total_value),
    takenAt: row.taken_at,
  });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("portfolio_snapshots")
    .select("total_value, taken_at")
    .eq("user_id", user.id)
    .gte("taken_at", since)
    .order("taken_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: `Snapshot read failed: ${error.message}` },
      { status: 500 },
    );
  }

  const points = ((data ?? []) as SnapshotRow[]).map((r) => ({
    totalValue: Number(r.total_value),
    takenAt: r.taken_at,
  }));

  return NextResponse.json({ points });
}
