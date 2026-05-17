import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchYahooNewsForTicker } from "@/lib/yahooFinance";

export const dynamic = "force-dynamic";

const CONCURRENCY = 4;
const PER_TICKER_LIMIT = 15;
const TOTAL_LIMIT = 50;

type ResponseItem = {
  uuid: string;
  title: string;
  publisher: string;
  link: string;
  timestamp: number;
  ticker: string;
  summary?: string;
};

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tickersParam = new URL(request.url).searchParams.get("tickers");
  if (!tickersParam) {
    return NextResponse.json({ news: [] });
  }
  const tickers = tickersParam
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);
  if (tickers.length === 0) {
    return NextResponse.json({ news: [] });
  }

  // uuid (or link fallback) → item; dedupes the same story appearing
  // under multiple tickers.
  const merged = new Map<string, ResponseItem>();

  for (let i = 0; i < tickers.length; i += CONCURRENCY) {
    const chunk = tickers.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map(async (ticker) => ({
        ticker,
        news: await fetchYahooNewsForTicker(ticker, PER_TICKER_LIMIT),
      })),
    );
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      const { ticker, news } = r.value;
      for (const item of news) {
        const key = item.uuid || item.link;
        if (!key || merged.has(key)) continue;
        merged.set(key, {
          uuid: item.uuid,
          title: item.title,
          publisher: item.publisher,
          link: item.link,
          timestamp: item.providerPublishTime,
          ticker,
          summary: item.summary,
        });
      }
    }
  }

  const all = Array.from(merged.values())
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, TOTAL_LIMIT);

  return NextResponse.json({ news: all });
}
