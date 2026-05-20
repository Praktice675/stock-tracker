// Server-only helper that builds the portfolio context block injected into
// the Pulse Plus system prompt. The same data (and more) is available via
// the get_portfolio_summary tool — but injecting it up-front means the first
// portfolio question on Plus doesn't pay a tool-call round-trip latency.

import YahooFinance from "yahoo-finance2";
import { createClient } from "@/lib/supabase/server";

const yf = new YahooFinance({
  validation: { logErrors: false },
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});

export type PortfolioContextPosition = {
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  percentOfPortfolio: number;
  sector?: string;
};

export type PortfolioContext = {
  totalValue: number;
  totalCost: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  positions: PortfolioContextPosition[];
  watchlist: string[];
  asOf: string;
};

type PositionRow = {
  symbol: string | null;
  quantity: number | null;
  avg_cost: number | null;
  current_price: number | null;
};

type WatchlistRow = { symbol: string | null };

export async function getPortfolioContext(): Promise<PortfolioContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Brokerage positions — the column is `avg_cost` in this schema (not
  // `average_purchase_price`); see lib/portfolio/brokerage.ts.
  const [positionsRes, watchlistRes] = await Promise.all([
    supabase
      .from("brokerage_positions")
      .select("symbol, quantity, avg_cost, current_price")
      .eq("user_id", user.id),
    supabase
      .from("watchlist_items")
      .select("symbol")
      .eq("user_id", user.id),
  ]);

  const rawPositions = (positionsRes.data ?? []) as PositionRow[];
  const watchlist = ((watchlistRes.data ?? []) as WatchlistRow[])
    .map((w) => w.symbol)
    .filter((s): s is string => typeof s === "string" && s.length > 0);

  // Drop rows missing the fields we need to compute meaningful P&L.
  const usable = rawPositions.filter(
    (p): p is {
      symbol: string;
      quantity: number;
      avg_cost: number;
      current_price: number;
    } =>
      typeof p.symbol === "string" &&
      typeof p.quantity === "number" &&
      typeof p.avg_cost === "number" &&
      typeof p.current_price === "number" &&
      p.quantity > 0,
  );

  if (usable.length === 0) {
    return {
      totalValue: 0,
      totalCost: 0,
      unrealizedPnL: 0,
      unrealizedPnLPercent: 0,
      positions: [],
      watchlist,
      asOf: new Date().toISOString(),
    };
  }

  const totalValue = usable.reduce(
    (s, p) => s + p.quantity * p.current_price,
    0,
  );
  const totalCost = usable.reduce(
    (s, p) => s + p.quantity * p.avg_cost,
    0,
  );

  // Enrich the top 10 by market value with sector info. Capped + parallel
  // so a slow yahoo call doesn't gate the whole chat.
  const topSymbols = usable
    .slice()
    .sort(
      (a, b) =>
        b.quantity * b.current_price - a.quantity * a.current_price,
    )
    .slice(0, 10)
    .map((p) => p.symbol);

  const sectorMap = new Map<string, string>();
  await Promise.allSettled(
    topSymbols.map(async (sym) => {
      try {
        const q = await yf.quoteSummary(sym, { modules: ["assetProfile"] });
        const sector = q?.assetProfile?.sector;
        if (typeof sector === "string" && sector.length > 0) {
          sectorMap.set(sym, sector);
        }
      } catch {
        // Yahoo can rate-limit or miss — sector is an optional enrichment.
      }
    }),
  );

  const enriched: PortfolioContextPosition[] = usable
    .map((p) => {
      const marketValue = p.quantity * p.current_price;
      const positionCost = p.quantity * p.avg_cost;
      const pnl = marketValue - positionCost;
      const pnlPct = positionCost > 0 ? (pnl / positionCost) * 100 : 0;
      return {
        symbol: p.symbol,
        quantity: p.quantity,
        avgCost: p.avg_cost,
        currentPrice: p.current_price,
        marketValue,
        unrealizedPnL: pnl,
        unrealizedPnLPercent: pnlPct,
        percentOfPortfolio:
          totalValue > 0 ? (marketValue / totalValue) * 100 : 0,
        sector: sectorMap.get(p.symbol),
      };
    })
    .sort((a, b) => b.marketValue - a.marketValue);

  const unrealizedPnL = totalValue - totalCost;
  const unrealizedPnLPercent =
    totalCost > 0 ? (unrealizedPnL / totalCost) * 100 : 0;

  return {
    totalValue,
    totalCost,
    unrealizedPnL,
    unrealizedPnLPercent,
    positions: enriched,
    watchlist,
    asOf: new Date().toISOString(),
  };
}

// Serialize for system-prompt injection. Keep it compact — Claude reads it
// once at the top of every Plus conversation.
export function portfolioContextToPrompt(ctx: PortfolioContext): string {
  if (ctx.positions.length === 0) {
    const watchlistLine =
      ctx.watchlist.length > 0
        ? `\nThe user has these tickers on their watchlist (not held): ${ctx.watchlist.join(", ")}.`
        : "";
    return `The user has not connected a brokerage yet. They have no positions to analyze.${watchlistLine}`;
  }

  const lines: string[] = [];
  lines.push(`Portfolio summary as of ${ctx.asOf}:`);
  lines.push(`- Total market value: $${ctx.totalValue.toFixed(2)}`);
  lines.push(`- Total cost basis: $${ctx.totalCost.toFixed(2)}`);
  lines.push(
    `- Unrealized P&L: $${ctx.unrealizedPnL.toFixed(2)} (${ctx.unrealizedPnLPercent.toFixed(2)}%)`,
  );
  lines.push("");
  lines.push("Positions (sorted by market value, largest first):");
  for (const p of ctx.positions) {
    const sectorPart = p.sector ? ` [${p.sector}]` : "";
    lines.push(
      `- ${p.symbol}${sectorPart}: ${p.quantity} shares @ avg $${p.avgCost.toFixed(2)}, ` +
        `current $${p.currentPrice.toFixed(2)}, value $${p.marketValue.toFixed(2)} ` +
        `(${p.percentOfPortfolio.toFixed(1)}% of portfolio), ` +
        `P&L $${p.unrealizedPnL.toFixed(2)} (${p.unrealizedPnLPercent.toFixed(2)}%)`,
    );
  }
  if (ctx.watchlist.length > 0) {
    lines.push("");
    lines.push(`Watchlist (not held): ${ctx.watchlist.join(", ")}`);
  }
  return lines.join("\n");
}
