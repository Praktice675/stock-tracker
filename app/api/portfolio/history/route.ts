import { NextRequest, NextResponse } from "next/server";
import {
  computePortfolioHistory,
  type PortfolioTransaction,
  type Timeframe,
} from "@/lib/portfolio/history";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const VALID_TIMEFRAMES: Timeframe[] = ["1W", "1M", "3M", "YTD", "1Y", "ALL"];

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = new URL(request.url).searchParams.get("timeframe");
  const timeframe: Timeframe = VALID_TIMEFRAMES.includes(raw as Timeframe)
    ? (raw as Timeframe)
    : "ALL";

  const { data, error } = await supabase
    .from("portfolio_transactions")
    .select("ticker, type, shares, price, executed_at")
    .order("executed_at", { ascending: true });

  if (error) {
    console.warn("portfolio history: tx select failed:", error.message);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  const transactions: PortfolioTransaction[] = (data ?? []).map((r) => ({
    ticker: String(r.ticker),
    type: r.type as "buy" | "sell",
    shares: Number(r.shares),
    price: Number(r.price),
    executed_at: String(r.executed_at),
  }));

  try {
    const result = await computePortfolioHistory(transactions, timeframe);
    return NextResponse.json({ ...result, timeframe });
  } catch (err) {
    console.warn(
      "portfolio history: compute failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json({ error: "Compute failed" }, { status: 500 });
  }
}
