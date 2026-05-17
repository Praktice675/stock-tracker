import { createClient } from "@/lib/supabase/server";
import { fetchYahooQuote } from "@/lib/yahooFinance";

export type RawTransaction = {
  id: string;
  ticker: string;
  type: "buy" | "sell";
  shares: number;
  price: number;
  executed_at: string;
  notes: string | null;
};

export type Holding = {
  ticker: string;
  name: string | null;
  shares: number;
  avgCost: number;
  currentPrice: number;
  previousClose: number;
  marketValue: number;
  costBasis: number;
  gainLossDollar: number;
  gainLossPercent: number;
  todayPLDollar: number;
  todayPLPercent: number;
  allocationPercent: number;
  priceUnavailable: boolean;
};

export type PortfolioTotals = {
  totalValue: number;
  totalCost: number;
  totalPLDollar: number;
  totalPLPercent: number;
  todayPLDollar: number;
  todayPLPercent: number;
};

export type PortfolioData = {
  holdings: Holding[];
  totals: PortfolioTotals;
  recentTransactions: RawTransaction[];
  hasAnyTransaction: boolean;
};

type RawPosition = {
  ticker: string;
  shares: number;
  totalInvested: number;
};

// Inline FIFO-ish avg-cost roll-up matching the client computePositions
// in lib/db/portfolio.ts. Inlined so this server module has no client deps.
function rollUpPositions(transactions: RawTransaction[]): RawPosition[] {
  const map = new Map<string, { shares: number; totalInvested: number }>();
  const sorted = [...transactions].sort(
    (a, b) =>
      new Date(a.executed_at).getTime() - new Date(b.executed_at).getTime(),
  );
  for (const tx of sorted) {
    const cur = map.get(tx.ticker) ?? { shares: 0, totalInvested: 0 };
    if (tx.type === "buy") {
      cur.shares += tx.shares;
      cur.totalInvested += tx.shares * tx.price;
    } else if (cur.shares > 0) {
      const sellRatio = Math.min(tx.shares / cur.shares, 1);
      cur.totalInvested -= cur.totalInvested * sellRatio;
      cur.shares -= tx.shares;
    }
    if (cur.shares > 0) map.set(tx.ticker, cur);
    else map.delete(tx.ticker);
  }
  return Array.from(map.entries()).map(([ticker, p]) => ({
    ticker,
    shares: p.shares,
    totalInvested: p.totalInvested,
  }));
}

export async function getPortfolioData(): Promise<PortfolioData> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("portfolio_transactions")
    .select("id, ticker, type, shares, price, executed_at, notes")
    .order("executed_at", { ascending: false });

  if (error) {
    console.warn("getPortfolioData: select failed:", error.message);
    return {
      holdings: [],
      totals: emptyTotals(),
      recentTransactions: [],
      hasAnyTransaction: false,
    };
  }

  const transactions = (data ?? []) as RawTransaction[];
  const positions = rollUpPositions(transactions);

  // Parallel quote fetches; one failure doesn't tank the rest.
  const quoted = await Promise.allSettled(
    positions.map(async (p) => ({
      pos: p,
      quote: await fetchYahooQuote(p.ticker),
    })),
  );

  const partialHoldings = quoted.map((r, i) => {
    const pos = positions[i];
    const avgCost = pos.shares > 0 ? pos.totalInvested / pos.shares : 0;
    const costBasis = pos.totalInvested;

    let currentPrice = avgCost;
    let previousClose = avgCost;
    let priceUnavailable = true;
    if (r.status === "fulfilled" && r.value.quote) {
      currentPrice = r.value.quote.price;
      previousClose = r.value.quote.previousClose;
      priceUnavailable = false;
    }

    const marketValue = pos.shares * currentPrice;
    const gainLossDollar = marketValue - costBasis;
    const gainLossPercent =
      costBasis > 0 ? (gainLossDollar / costBasis) * 100 : 0;
    const todayPLDollar = pos.shares * (currentPrice - previousClose);
    const todayPLPercent =
      previousClose > 0
        ? ((currentPrice - previousClose) / previousClose) * 100
        : 0;

    return {
      ticker: pos.ticker,
      name: null as string | null,
      shares: pos.shares,
      avgCost,
      currentPrice,
      previousClose,
      marketValue,
      costBasis,
      gainLossDollar,
      gainLossPercent,
      todayPLDollar,
      todayPLPercent,
      allocationPercent: 0,
      priceUnavailable,
    };
  });

  const totalValue = partialHoldings.reduce((s, h) => s + h.marketValue, 0);
  const totalCost = partialHoldings.reduce((s, h) => s + h.costBasis, 0);
  const totalPLDollar = totalValue - totalCost;
  const totalPLPercent =
    totalCost > 0 ? (totalPLDollar / totalCost) * 100 : 0;

  const yesterdayValue = partialHoldings.reduce(
    (s, h) => s + h.shares * h.previousClose,
    0,
  );
  const todayPLDollar = partialHoldings.reduce(
    (s, h) => s + h.todayPLDollar,
    0,
  );
  const todayPLPercent =
    yesterdayValue > 0 ? (todayPLDollar / yesterdayValue) * 100 : 0;

  const holdings: Holding[] = partialHoldings
    .map((h) => ({
      ...h,
      allocationPercent: totalValue > 0 ? (h.marketValue / totalValue) * 100 : 0,
    }))
    .sort((a, b) => b.marketValue - a.marketValue);

  return {
    holdings,
    totals: {
      totalValue,
      totalCost,
      totalPLDollar,
      totalPLPercent,
      todayPLDollar,
      todayPLPercent,
    },
    recentTransactions: transactions.slice(0, 10),
    hasAnyTransaction: transactions.length > 0,
  };
}

function emptyTotals(): PortfolioTotals {
  return {
    totalValue: 0,
    totalCost: 0,
    totalPLDollar: 0,
    totalPLPercent: 0,
    todayPLDollar: 0,
    todayPLPercent: 0,
  };
}
