import { NextResponse } from "next/server";
import { type YahooQuote, fetchYahooQuote } from "@/lib/yahooFinance";

// Public market data — safe to share across users via CDN cache.
// max-age=15 / s-maxage=15 lets the browser + CDN cache the response for
// 15s while the in-memory cache below absorbs anything that slips past
// (cold CDN node, no-store client, etc.). The 30s module Map is the
// authoritative guard against hammering Yahoo when polling intervals
// across many connected clients converge.
export const revalidate = 15;

const CACHE_TTL_MS = 30_000;

type CacheEntry = {
  quote: YahooQuote;
  fetchedAt: number;
};

// Module-scoped cache — shared across all requests handled by this
// Node.js process. Survives between requests but resets on cold start,
// which is fine: a cold start re-warms Yahoo at most once per ticker.
const cache = new Map<string, CacheEntry>();

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker: raw } = await params;
  const ticker = raw.toUpperCase();

  const cached = cache.get(ticker);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json(cached.quote, {
      headers: { "Cache-Control": "public, max-age=15, s-maxage=15" },
    });
  }

  const data = await fetchYahooQuote(ticker);
  if (!data) {
    return NextResponse.json(
      { error: "Failed" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  cache.set(ticker, { quote: data, fetchedAt: Date.now() });

  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, max-age=15, s-maxage=15" },
  });
}
