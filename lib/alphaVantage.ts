const BASE = "https://www.alphavantage.co/query";

export type Quote = {
  price: number;
  change: number;
  changePercent: number;
  volume: number;
};

export type Candle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

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

type TimeSeriesDailyResponse = {
  "Time Series (Daily)"?: Record<string, DailyRow>;
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
): Promise<Candle[] | null> {
  console.log("API KEY EXISTS:", !!process.env.ALPHA_VANTAGE_API_KEY);

  try {
    const key = process.env.ALPHA_VANTAGE_API_KEY;
    if (!key) {
      console.warn("fetchDailyCandles: missing ALPHA_VANTAGE_API_KEY");
      return null;
    }

    const url = `${BASE}?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(
      ticker,
    )}&outputsize=compact&apikey=${key}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`fetchDailyCandles: HTTP ${res.status} for ${ticker}`);
      return null;
    }

    const data = (await res.json()) as TimeSeriesDailyResponse;
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

    if (!("Time Series (Daily)" in data) || !data["Time Series (Daily)"]) {
      console.warn(
        `fetchDailyCandles: missing "Time Series (Daily)" for ${ticker}`,
      );
      return null;
    }

    const series = data["Time Series (Daily)"];
    const candles: Candle[] = Object.entries(series)
      .map(([date, row]) => ({
        time: date,
        open: parseFloat(row["1. open"]),
        high: parseFloat(row["2. high"]),
        low: parseFloat(row["3. low"]),
        close: parseFloat(row["4. close"]),
        volume: parseInt(row["5. volume"], 10),
      }))
      .filter((c) => Number.isFinite(c.close));

    candles.sort((a, b) => a.time.localeCompare(b.time));
    return candles.slice(-60);
  } catch (err) {
    console.error(
      `fetchDailyCandles: error for ${ticker}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
