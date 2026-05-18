import { NextResponse } from "next/server";
import { fetchYahooQuote } from "@/lib/yahooFinance";

// Public market data — safe to share across users via CDN cache.
// s-maxage=20: Vercel CDN serves the same response for 20s.
// stale-while-revalidate=60: serve stale up to 60s while we refetch in background.
export const revalidate = 20;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  const data = await fetchYahooQuote(ticker);
  if (!data) {
    return NextResponse.json(
      { error: "Failed" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=20, stale-while-revalidate=60",
    },
  });
}
