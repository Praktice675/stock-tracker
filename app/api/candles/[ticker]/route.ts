import { NextResponse } from "next/server";
import { type Candle, fetchDailyCandles } from "@/lib/alphaVantage";

function fallbackCandles(): Candle[] {
  // Static 10-candle placeholder used when Alpha Vantage is unavailable
  // (missing key, rate-limited, network error, malformed response, etc.)
  const start = new Date("2024-01-01T00:00:00Z");
  const closes = [180, 181.5, 180.8, 182.3, 181.7, 183.4, 184.1, 183.6, 185.2, 186.0];
  return closes.map((close, i) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + i);
    const time = date.toISOString().slice(0, 10);
    const open = i === 0 ? close - 0.6 : closes[i - 1];
    const high = Math.max(open, close) + 0.8;
    const low = Math.min(open, close) - 0.8;
    return { time, open, high, low, close, volume: 60_000_000 + i * 1_000_000 };
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  try {
    const { ticker } = await params;
    const data = await fetchDailyCandles(ticker);
    const body = data ?? fallbackCandles();
    return NextResponse.json(body, {
      headers: { "Cache-Control": "max-age=3600" },
    });
  } catch (err) {
    console.error("GET /api/candles error:", err);
    return NextResponse.json(fallbackCandles(), {
      headers: { "Cache-Control": "no-store" },
    });
  }
}
