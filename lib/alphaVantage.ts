const BASE = "https://www.alphavantage.co/query";

export type Quote = {
  price: number;
  change: number;
  changePercent: number;
  volume: number;
};

export type Candle = {
  // string ("YYYY-MM-DD") for daily candles, unix-seconds number for intraday
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type Timeframe = "1D" | "1W" | "1M" | "3M" | "1Y";

const VALID_TIMEFRAMES: Timeframe[] = ["1D", "1W", "1M", "3M", "1Y"];

export function isTimeframe(v: unknown): v is Timeframe {
  return typeof v === "string" && (VALID_TIMEFRAMES as string[]).includes(v);
}

type TimeframeConfig = {
  fn: "TIME_SERIES_DAILY" | "TIME_SERIES_INTRADAY";
  interval?: "5min" | "60min";
  outputsize: "compact" | "full";
  seriesKey: string;
  limit: number;
  intraday: boolean;
};

const TIMEFRAME_CONFIG: Record<Timeframe, TimeframeConfig> = {
  "1D": { fn: "TIME_SERIES_INTRADAY", interval: "5min", outputsize: "full",
          seriesKey: "Time Series (5min)", limit: 78, intraday: true },
  "1W": { fn: "TIME_SERIES_INTRADAY", interval: "60min", outputsize: "full",
          seriesKey: "Time Series (60min)", limit: 120, intraday: true },
  "1M": { fn: "TIME_SERIES_DAILY", outputsize: "compact",
          seriesKey: "Time Series (Daily)", limit: 30, intraday: false },
  "3M": { fn: "TIME_SERIES_DAILY", outputsize: "compact",
          seriesKey: "Time Series (Daily)", limit: 90, intraday: false },
  "1Y": { fn: "TIME_SERIES_DAILY", outputsize: "full",
          seriesKey: "Time Series (Daily)", limit: 365, intraday: false },
};

// Parse "2024-01-15 09:30:00" (US Eastern from AV) as if it were UTC,
// returning unix seconds. Result is mathematically off by the ET offset but
// makes the chart axis read like a normal NY trading day (9:30–16:00).
function parseIntradayTime(s: string): number {
  const isoLike = s.replace(" ", "T") + "Z";
  return Math.floor(new Date(isoLike).getTime() / 1000);
}

type GlobalQuoteResponse = {
  "Global Quote"?: {
    "05. price"?: string;
    "06. volume"?: string;
    "09. change"?: string;
    "10. change percent"?: string;
  };
};

type DailyRow = {
  "1. open": string;
  "2. high": string;
  "3. low": string;
  "4. close": string;
  "5. volume": string;
};

type TimeSeriesResponse = {
  [seriesKey: string]: unknown;
  Note?: string;
  Information?: string;
};

export async function fetchQuote(ticker: string): Promise<Quote | null> {
  const key = process.env.ALPHA_VANTAGE_API_KEY;
  if (!key) return null;

  try {
    const url = `${BASE}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(
      ticker,
    )}&apikey=${key}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const json = (await res.json()) as GlobalQuoteResponse;
    const q = json["Global Quote"];
    const priceStr = q?.["05. price"];
    if (!q || !priceStr) return null;

    const price = parseFloat(priceStr);
    const change = parseFloat(q["09. change"] ?? "0");
    const changePercent = parseFloat(
      String(q["10. change percent"] ?? "0").replace("%", ""),
    );
    const volume = parseInt(q["06. volume"] ?? "0", 10);

    if (!Number.isFinite(price)) return null;
    return { price, change, changePercent, volume };
  } catch {
    return null;
  }
}

export async function fetchDailyCandles(
  ticker: string,
  timeframe: Timeframe = "1M",
): Promise<Candle[] | null> {
  console.log("API KEY EXISTS:", !!process.env.ALPHA_VANTAGE_API_KEY);

  try {
    const key = process.env.ALPHA_VANTAGE_API_KEY;
    if (!key) {
      console.warn("fetchDailyCandles: missing ALPHA_VANTAGE_API_KEY");
      return null;
    }

    const cfg = TIMEFRAME_CONFIG[timeframe];
    const params = new URLSearchParams({
      function: cfg.fn,
      symbol: ticker,
      outputsize: cfg.outputsize,
      apikey: key,
    });
    if (cfg.interval) params.set("interval", cfg.interval);
    const url = `${BASE}?${params.toString()}`;
    console.log(`fetchDailyCandles: ${timeframe} for ${ticker}`);

    const res = await fetch(url);
    if (!res.ok) {
      console.warn(
        `fetchDailyCandles: HTTP ${res.status} for ${ticker} (${timeframe})`,
      );
      return null;
    }

    const data = (await res.json()) as TimeSeriesResponse;
    console.log("RAW RESPONSE:", JSON.stringify(data).slice(0, 500));

    if (data.Note) {
      console.warn(`fetchDailyCandles: rate-limit Note for ${ticker}:`, data.Note);
      return null;
    }
    if (data.Information) {
      console.warn(
        `fetchDailyCandles: Information for ${ticker}:`,
        data.Information,
      );
      return null;
    }

    const series = data[cfg.seriesKey] as
      | Record<string, DailyRow>
      | undefined;
    if (!series || typeof series !== "object") {
      console.warn(
        `fetchDailyCandles: missing "${cfg.seriesKey}" for ${ticker} (${timeframe})`,
      );
      return null;
    }

    const candles: Candle[] = Object.entries(series)
      .map(([rawTime, row]) => ({
        time: cfg.intraday
          ? parseIntradayTime(rawTime)
          : rawTime,
        open: parseFloat(row["1. open"]),
        high: parseFloat(row["2. high"]),
        low: parseFloat(row["3. low"]),
        close: parseFloat(row["4. close"]),
        volume: parseInt(row["5. volume"], 10),
      }))
      .filter((c) => Number.isFinite(c.close));

    candles.sort((a, b) => {
      // Both strings (daily) compare lexicographically; both numbers
      // (intraday) compare numerically. Mixed shouldn't happen — same call
      // produces one resolution.
      if (typeof a.time === "number" && typeof b.time === "number") {
        return a.time - b.time;
      }
      return String(a.time).localeCompare(String(b.time));
    });

    return candles.slice(-cfg.limit);
  } catch (err) {
    console.error(
      `fetchDailyCandles: error for ${ticker}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
