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

  // No positions yet — nothing to snapshot, but not an error.
  if (uniqueSymbols.length === 0) {
    return NextResponse.json({
      skipped: true,
      reason: "no positions",
    });
  }

  // Parallel fetch. We REQUIRE every quote to succeed — if any ticker comes
  // back null, we abort the snapshot rather than recording an incomplete
  // total. Recording with a missing quote treated as $0 was the source of
  // the chart "drop to zero" artifact; better to have a small gap than a
  // misleading row.
  const priceEntries = await Promise.all(
    uniqueSymbols.map(async (sym) => {
      const q = await fetchYahooQuote(sym);
      return [sym, q?.price ?? null] as const;
    }),
  );

  const failedSymbols = priceEntries
    .filter(([, price]) => typeof price !== "number" || !Number.isFinite(price))
    .map(([sym]) => sym);

  if (failedSymbols.length > 0) {
    return NextResponse.json({
      skipped: true,
      reason: "incomplete data",
      failedSymbols,
    });
  }

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

  // Belt and suspenders — if we somehow computed zero (e.g. all positions
  // were filtered above), skip rather than polluting the series.
  if (totalValue <= 0) {
    return NextResponse.json({
      skipped: true,
      reason: "incomplete data",
    });
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

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const range = new URL(req.url).searchParams.get("range");
  const isAll = range === "all";

  let query = supabase
    .from("portfolio_snapshots")
    .select("total_value, taken_at")
    .eq("user_id", user.id)
    .order("taken_at", { ascending: true });

  if (!isAll) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("taken_at", since);
  }

  const { data, error } = await query;

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
