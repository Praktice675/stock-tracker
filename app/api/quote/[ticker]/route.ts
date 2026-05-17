import { NextResponse } from "next/server";
import { fetchYahooQuote } from "@/lib/yahooFinance";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  const data = await fetchYahooQuote(ticker);
  if (!data) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
  return NextResponse.json(data);
}
