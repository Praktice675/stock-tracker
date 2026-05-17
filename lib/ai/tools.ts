import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import YahooFinance from "yahoo-finance2";
import { getPortfolioData } from "@/lib/portfolio/compute";
import {
  fetchHistoricalCloses,
  fetchYahooNewsForTicker,
  fetchYahooQuote,
} from "@/lib/yahooFinance";

// Reuse the project's existing yahoo-finance2 v3 instance pattern. quoteSummary
// powers get_stats; the existing fetchYahooQuote/fetchYahooNewsForTicker helpers
// cover everything else.
const yf = new YahooFinance({
  validation: { logErrors: false },
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_portfolio_summary",
    description:
      "Get the user's current portfolio: holdings, total value, P&L, allocation. Use when the user asks about their portfolio performance, holdings, or how they're doing.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_watchlist",
    description: "Get the tickers in the user's watchlist.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_quote",
    description:
      "Get current price and today's change for a specific ticker. Use when discussing a specific stock's current state.",
    input_schema: {
      type: "object",
      properties: {
        ticker: {
          type: "string",
          description: "Stock ticker symbol like AAPL or NVDA",
        },
      },
      required: ["ticker"],
    },
  },
  {
    name: "get_stats",
    description:
      "Get fundamental stats for a ticker: market cap, P/E ratio, EPS, 52-week range, beta, dividend yield, analyst ratings.",
    input_schema: {
      type: "object",
      properties: { ticker: { type: "string" } },
      required: ["ticker"],
    },
  },
  {
    name: "get_news",
    description:
      "Get recent news articles for a ticker. Use when the user wants to know what's happening with a stock.",
    input_schema: {
      type: "object",
      properties: {
        ticker: { type: "string" },
        count: { type: "number", description: "Max 5" },
      },
      required: ["ticker"],
    },
  },
  {
    name: "get_earnings_calendar",
    description:
      "Get upcoming earnings dates for the user's watchlist tickers (next 7 days).",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_market_indices",
    description:
      "Get current values for major market indices: S&P 500 (SPY), NASDAQ (QQQ), DOW (DIA), VIX.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_historical_performance",
    description:
      "Get historical price performance for a ticker over a specified period. Use for questions about how a stock or index performed last week, last month, year-to-date, etc. Returns start price, end price, percent change, high, low, and closing prices for the period. The ticker can be any stock OR market index symbol: SPY (S&P 500), QQQ (NASDAQ), DIA (Dow), VIX (volatility).",
    input_schema: {
      type: "object",
      properties: {
        ticker: {
          type: "string",
          description: "Stock or index ticker symbol",
        },
        period: {
          type: "string",
          enum: ["1W", "1M", "3M", "YTD", "1Y"],
          description:
            "Time period: 1W=last week, 1M=last month, 3M=last 3 months, YTD=year to date, 1Y=last year",
        },
      },
      required: ["ticker", "period"],
    },
  },
];

type AnyRec = Record<string, unknown>;

function numOrNull(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v;
}

function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

async function fetchStats(ticker: string) {
  const data = await yf.quoteSummary(ticker, {
    modules: [
      "summaryDetail",
      "defaultKeyStatistics",
      "financialData",
      "price",
      "recommendationTrend",
      "assetProfile",
    ],
  });
  const sd = (data.summaryDetail ?? {}) as AnyRec;
  const ks = (data.defaultKeyStatistics ?? {}) as AnyRec;
  const fd = (data.financialData ?? {}) as AnyRec;
  const pr = (data.price ?? {}) as AnyRec;
  const ap = (data.assetProfile ?? {}) as AnyRec;
  const trendArr = (data.recommendationTrend?.trend ?? []) as AnyRec[];
  const rt = (trendArr[0] ?? {}) as AnyRec;

  const strongBuy = numOrNull(rt.strongBuy) ?? 0;
  const buy = numOrNull(rt.buy) ?? 0;
  const hold = numOrNull(rt.hold) ?? 0;
  const sell = numOrNull(rt.sell) ?? 0;
  const strongSell = numOrNull(rt.strongSell) ?? 0;
  const total = strongBuy + buy + hold + sell + strongSell;

  return {
    name: strOrNull(pr.shortName) ?? strOrNull(pr.longName) ?? ticker,
    sector: strOrNull(ap.sector),
    marketCap: numOrNull(sd.marketCap),
    peRatio: numOrNull(sd.trailingPE),
    eps: numOrNull(ks.trailingEps),
    revenue: numOrNull(fd.totalRevenue),
    fiftyTwoWeekHigh: numOrNull(sd.fiftyTwoWeekHigh),
    fiftyTwoWeekLow: numOrNull(sd.fiftyTwoWeekLow),
    avgVolume: numOrNull(sd.averageVolume),
    beta: numOrNull(sd.beta),
    dividendYield: numOrNull(sd.dividendYield), // fraction 0–1
    floatShares: numOrNull(ks.floatShares),
    analystRatings:
      total > 0
        ? {
            buyPercent: ((strongBuy + buy) / total) * 100,
            holdPercent: (hold / total) * 100,
            sellPercent: ((sell + strongSell) / total) * 100,
            totalAnalysts: total,
          }
        : null,
  };
}

async function fetchUpcomingEarnings(tickers: string[]) {
  if (tickers.length === 0) return { earnings: [] };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(end.getDate() + 7);
  end.setHours(23, 59, 59, 999);

  // Chunked-concurrency Yahoo quoteSummary, matching the /api/earnings pattern.
  const CONCURRENCY = 4;
  type Item = {
    ticker: string;
    date: string;
    time: "bmo" | "amc" | null;
    epsEstimate: number | null;
    name: string | null;
  };
  const out: Item[] = [];
  for (let i = 0; i < tickers.length; i += CONCURRENCY) {
    const chunk = tickers.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map(async (ticker): Promise<Item | null> => {
        try {
          const data = await yf.quoteSummary(ticker, {
            modules: ["calendarEvents", "price"],
          });
          const earningsDates =
            data?.calendarEvents?.earnings?.earningsDate;
          if (!Array.isArray(earningsDates) || earningsDates.length === 0)
            return null;
          const raw = earningsDates[0];
          const d = raw instanceof Date ? raw : new Date(raw);
          if (Number.isNaN(d.getTime())) return null;
          if (d < today || d > end) return null;
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          const utcHour = d.getUTCHours();
          let time: "bmo" | "amc" | null = null;
          if (utcHour >= 12 && utcHour < 16) time = "bmo";
          else if (utcHour >= 20 || utcHour < 4) time = "amc";
          return {
            ticker,
            date: `${yyyy}-${mm}-${dd}`,
            time,
            epsEstimate: numOrNull(
              data?.calendarEvents?.earnings?.earningsAverage,
            ),
            name:
              strOrNull(data?.price?.shortName) ??
              strOrNull(data?.price?.longName),
          };
        } catch {
          return null;
        }
      }),
    );
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) out.push(r.value);
    }
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return { earnings: out };
}

export async function executeTool(
  name: string,
  input: unknown,
  supabase: SupabaseClient,
): Promise<unknown> {
  const args = (input ?? {}) as AnyRec;
  try {
    switch (name) {
      case "get_portfolio_summary": {
        const data = await getPortfolioData();
        return {
          totalValue: data.totals.totalValue,
          totalCost: data.totals.totalCost,
          totalPL: data.totals.totalPLDollar,
          totalPLPercent: data.totals.totalPLPercent,
          todaysPL: data.totals.todayPLDollar,
          todaysPLPercent: data.totals.todayPLPercent,
          holdings: data.holdings.map((h) => ({
            ticker: h.ticker,
            name: h.name,
            shares: h.shares,
            avgCost: h.avgCost,
            currentPrice: h.priceUnavailable ? null : h.currentPrice,
            marketValue: h.priceUnavailable ? null : h.marketValue,
            gainLossDollar: h.priceUnavailable ? null : h.gainLossDollar,
            gainLossPercent: h.priceUnavailable ? null : h.gainLossPercent,
            allocationPercent: h.allocationPercent,
          })),
        };
      }

      case "get_watchlist": {
        const { data, error } = await supabase
          .from("watchlist_items")
          .select("ticker, name")
          .order("position", { ascending: true });
        if (error) return { error: error.message };
        return { tickers: data ?? [] };
      }

      case "get_quote": {
        const ticker = String(args.ticker || "").trim().toUpperCase();
        if (!ticker) return { error: "ticker required" };
        const q = await fetchYahooQuote(ticker);
        if (!q) return { error: `Quote unavailable for ${ticker}` };
        return {
          ticker,
          name: q.name,
          price: q.price,
          change: q.change,
          changePercent: q.changePercent,
          previousClose: q.previousClose,
        };
      }

      case "get_stats": {
        const ticker = String(args.ticker || "").trim().toUpperCase();
        if (!ticker) return { error: "ticker required" };
        return await fetchStats(ticker);
      }

      case "get_news": {
        const ticker = String(args.ticker || "").trim().toUpperCase();
        const rawCount = Number(args.count);
        const count =
          Number.isFinite(rawCount) && rawCount > 0
            ? Math.min(Math.floor(rawCount), 5)
            : 5;
        if (!ticker) return { error: "ticker required" };
        const news = await fetchYahooNewsForTicker(ticker, count);
        return {
          articles: news.slice(0, count).map((n) => ({
            title: n.title,
            publisher: n.publisher,
            timestamp: n.providerPublishTime,
            link: n.link,
            summary: n.summary,
          })),
        };
      }

      case "get_earnings_calendar": {
        const { data: rows } = await supabase
          .from("watchlist_items")
          .select("ticker")
          .order("position", { ascending: true });
        const tickers = (rows ?? [])
          .map((r) => (typeof r.ticker === "string" ? r.ticker : null))
          .filter((t): t is string => !!t);
        return await fetchUpcomingEarnings(tickers);
      }

      case "get_historical_performance": {
        const ticker = String(args.ticker || "").trim().toUpperCase();
        const period = String(args.period || "");
        if (!ticker) return { error: "ticker required" };
        if (!["1W", "1M", "3M", "YTD", "1Y"].includes(period)) {
          return { error: "period must be 1W, 1M, 3M, YTD, or 1Y" };
        }

        const toDate = new Date();
        const fromDate = new Date();
        switch (period) {
          case "1W":
            fromDate.setDate(fromDate.getDate() - 7);
            break;
          case "1M":
            fromDate.setMonth(fromDate.getMonth() - 1);
            break;
          case "3M":
            fromDate.setMonth(fromDate.getMonth() - 3);
            break;
          case "YTD":
            fromDate.setMonth(0);
            fromDate.setDate(1);
            break;
          case "1Y":
            fromDate.setFullYear(fromDate.getFullYear() - 1);
            break;
        }

        const prices = await fetchHistoricalCloses(ticker, fromDate, toDate);
        if (!prices || prices.length === 0) {
          return { error: `No historical data available for ${ticker}` };
        }

        const startPrice = prices[0].close;
        const endPrice = prices[prices.length - 1].close;
        const changeDollar = endPrice - startPrice;
        const changePercent =
          startPrice !== 0 ? (changeDollar / startPrice) * 100 : 0;
        const closes = prices.map((p) => p.close);
        const high = Math.max(...closes);
        const low = Math.min(...closes);

        return {
          ticker,
          period,
          startDate: prices[0].date,
          endDate: prices[prices.length - 1].date,
          startPrice: Number(startPrice.toFixed(2)),
          endPrice: Number(endPrice.toFixed(2)),
          changeDollar: Number(changeDollar.toFixed(2)),
          changePercent: Number(changePercent.toFixed(2)),
          high: Number(high.toFixed(2)),
          low: Number(low.toFixed(2)),
          dataPoints: prices.length,
        };
      }

      case "get_market_indices": {
        const indexTickers = [
          { ticker: "SPY", label: "SP500" },
          { ticker: "QQQ", label: "NASDAQ" },
          { ticker: "DIA", label: "DOW" },
          { ticker: "^VIX", label: "VIX" },
        ];
        const results = await Promise.allSettled(
          indexTickers.map((t) => fetchYahooQuote(t.ticker)),
        );
        const indices: Record<string, unknown> = {};
        results.forEach((r, i) => {
          const { label } = indexTickers[i];
          if (r.status === "fulfilled" && r.value) {
            indices[label] = {
              price: r.value.price,
              change: r.value.change,
              changePercent: r.value.changePercent,
            };
          } else {
            indices[label] = { error: "unavailable" };
          }
        });
        return indices;
      }

      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Tool execution failed",
    };
  }
}
