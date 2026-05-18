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
  open: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  exchange: string | null;
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
    // fullExchangeName isn't on the SDK's public typings for v3 quote(),
    // but Yahoo's payload reliably includes it. Cast and string-check.
    const qx = q as typeof q & { fullExchangeName?: unknown };
    const exchange =
      typeof qx.fullExchangeName === "string" && qx.fullExchangeName.length > 0
        ? qx.fullExchangeName
        : null;
    return {
      price: q.regularMarketPrice,
      change: q.regularMarketChange ?? 0,
      changePercent: q.regularMarketChangePercent ?? 0,
      volume: q.regularMarketVolume ?? 0,
      previousClose: q.regularMarketPreviousClose ?? q.regularMarketPrice,
      open: q.regularMarketOpen ?? null,
      dayHigh: q.regularMarketDayHigh ?? null,
      dayLow: q.regularMarketDayLow ?? null,
      exchange,
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
    // Intraday ranges need extra period1 cushion: Yahoo's chart endpoint
    // returns only bars *after* period1 — it does not look backward for
    // the last trading day. If period1 lands in a weekend/holiday gap with
    // no later bars yet (e.g. Sunday, or Monday before market open), the
    // response is `{quotes: []}`, the route falls back to its hardcoded
    // 2024 fixture, and the chart shows stale dates. The .slice(-limit)
    // below trims back to a single session worth of bars.
    case "1D":
      return { period1: daysAgo(7), interval: "5m", intraday: true, limit: 78 };
    case "1W":
      return { period1: daysAgo(14), interval: "60m", intraday: true, limit: 120 };
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

export type YahooNewsItem = {
  uuid: string;
  title: string;
  publisher: string;
  link: string;
  providerPublishTime: number; // Unix seconds
  relatedTickers: string[];
  summary?: string;
};

// Yahoo search() returns a `news` array per query. Map and clean for our
// shape; return [] on error so the caller can keep aggregating.
export async function fetchYahooNewsForTicker(
  ticker: string,
  count: number = 10,
): Promise<YahooNewsItem[]> {
  try {
    const result = await yahooFinance.search(ticker, {
      newsCount: count,
      quotesCount: 0,
    });
    const news = (result as { news?: unknown[] })?.news ?? [];
    const items: YahooNewsItem[] = [];
    for (const raw of news) {
      const n = raw as Record<string, unknown>;
      const title = typeof n.title === "string" ? n.title : null;
      const link = typeof n.link === "string" ? n.link : null;
      if (!title || !link) continue;

      // providerPublishTime can be a Unix-seconds number or a Date.
      let time: number | null = null;
      const t = n.providerPublishTime;
      if (typeof t === "number" && Number.isFinite(t)) time = t;
      else if (t instanceof Date) time = Math.floor(t.getTime() / 1000);
      if (time == null) continue;

      const relatedTickers = Array.isArray(n.relatedTickers)
        ? (n.relatedTickers as unknown[]).filter(
            (x): x is string => typeof x === "string",
          )
        : [];

      items.push({
        uuid: typeof n.uuid === "string" && n.uuid.length > 0 ? n.uuid : link,
        title,
        publisher: typeof n.publisher === "string" ? n.publisher : "",
        link,
        providerPublishTime: time,
        relatedTickers,
        summary: typeof n.summary === "string" ? n.summary : undefined,
      });
    }
    items.sort((a, b) => b.providerPublishTime - a.providerPublishTime);
    return items;
  } catch (err) {
    console.warn(
      `fetchYahooNewsForTicker(${ticker}) failed:`,
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

// Daily closes between two dates, inclusive of both ends Yahoo provides.
// Used by the portfolio history compute; returns null on error so callers
// can degrade gracefully.
export async function fetchHistoricalCloses(
  ticker: string,
  fromDate: Date,
  toDate: Date,
): Promise<{ date: string; close: number }[] | null> {
  try {
    const result = await yahooFinance.chart(ticker, {
      period1: fromDate,
      period2: toDate,
      interval: "1d",
    });
    const quotes = result?.quotes ?? [];
    const out: { date: string; close: number }[] = [];
    for (const q of quotes) {
      if (!q?.date || q.close == null) continue;
      const d = q.date instanceof Date ? q.date : new Date(q.date);
      if (Number.isNaN(d.getTime())) continue;
      out.push({ date: isoDate(d), close: Number(q.close) });
    }
    out.sort((a, b) => a.date.localeCompare(b.date));
    return out;
  } catch (err) {
    console.warn(
      `fetchHistoricalCloses ${ticker} failed:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
