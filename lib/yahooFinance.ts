import YahooFinance from "yahoo-finance2";

// v3 swapped `setGlobalConfig` for constructor options. We build a single
// instance at module load with logErrors off + the first-use notices muted.
const yahooFinance = new YahooFinance({
  validation: { logErrors: false },
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});

export type YahooQuote = {
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  previousClose: number;
  name: string | null;
};

export type YahooCandle = {
  // "YYYY-MM-DD" for daily; unix seconds for intraday
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type YahooTimeframe = "1D" | "1W" | "1M" | "3M" | "1Y";

const VALID_TIMEFRAMES: YahooTimeframe[] = ["1D", "1W", "1M", "3M", "1Y"];

export function isYahooTimeframe(v: unknown): v is YahooTimeframe {
  return typeof v === "string" && (VALID_TIMEFRAMES as string[]).includes(v);
}

export type SearchResult = { ticker: string; name: string };

export async function fetchYahooSearch(
  query: string,
): Promise<SearchResult[]> {
  try {
    const result = await yahooFinance.search(query);
    const quotes = Array.isArray(result?.quotes) ? result.quotes : [];
    const out: SearchResult[] = [];
    for (const r of quotes) {
      if (!r || typeof r !== "object") continue;
      if (!("isYahooFinance" in r) || r.isYahooFinance !== true) continue;
      if (r.quoteType !== "EQUITY" && r.quoteType !== "ETF") continue;
      const symbol = typeof r.symbol === "string" ? r.symbol : null;
      if (!symbol) continue;
      const shortname =
        typeof r.shortname === "string" ? r.shortname : undefined;
      const longname = typeof r.longname === "string" ? r.longname : undefined;
      out.push({ ticker: symbol, name: shortname || longname || symbol });
      if (out.length >= 6) break;
    }
    return out;
  } catch (err) {
    console.warn(
      `fetchYahooSearch("${query}") failed:`,
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

export async function fetchYahooQuote(
  ticker: string,
): Promise<YahooQuote | null> {
  try {
    const q = await yahooFinance.quote(ticker);
    if (!q || typeof q.regularMarketPrice !== "number") {
      console.warn(`fetchYahooQuote: no price for ${ticker}`);
      return null;
    }
    return {
      price: q.regularMarketPrice,
      change: q.regularMarketChange ?? 0,
      changePercent: q.regularMarketChangePercent ?? 0,
      volume: q.regularMarketVolume ?? 0,
      previousClose: q.regularMarketPreviousClose ?? q.regularMarketPrice,
      name: q.shortName ?? q.longName ?? null,
    };
  } catch (err) {
    console.warn(
      `fetchYahooQuote: ${ticker} failed:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

type ChartConfig = {
  period1: Date;
  interval: "5m" | "60m" | "1d";
  intraday: boolean;
  limit: number;
};

function chartConfig(tf: YahooTimeframe): ChartConfig {
  switch (tf) {
    case "1D":
      return { period1: daysAgo(2), interval: "5m", intraday: true, limit: 78 };
    case "1W":
      return { period1: daysAgo(7), interval: "60m", intraday: true, limit: 120 };
    case "1M":
      return { period1: daysAgo(35), interval: "1d", intraday: false, limit: 30 };
    case "3M":
      return { period1: daysAgo(95), interval: "1d", intraday: false, limit: 90 };
    case "1Y":
      return { period1: daysAgo(370), interval: "1d", intraday: false, limit: 365 };
  }
}

export async function fetchYahooCandles(
  ticker: string,
  timeframe: YahooTimeframe,
): Promise<YahooCandle[] | null> {
  try {
    // Note: yahoo-finance2 v3 deprecated historical() — it silently maps to
    // chart() and the bridge mangles `events`, breaking validation. We call
    // chart() directly for every timeframe.
    const cfg = chartConfig(timeframe);
    const result = await yahooFinance.chart(ticker, {
      period1: cfg.period1,
      interval: cfg.interval,
    });
    const quotes = result?.quotes ?? [];

    const out: YahooCandle[] = [];
    for (const q of quotes) {
      if (
        !q?.date ||
        q.open == null ||
        q.high == null ||
        q.low == null ||
        q.close == null
      ) {
        continue;
      }
      out.push({
        time: cfg.intraday
          ? Math.floor(q.date.getTime() / 1000)
          : isoDate(q.date),
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
        volume: q.volume ?? 0,
      });
    }

    out.sort((a, b) => {
      if (typeof a.time === "number" && typeof b.time === "number") {
        return a.time - b.time;
      }
      return String(a.time).localeCompare(String(b.time));
    });

    return out.slice(-cfg.limit);
  } catch (err) {
    console.warn(
      `fetchYahooCandles: ${ticker} (${timeframe}) failed:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
