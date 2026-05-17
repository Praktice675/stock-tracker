import { NextResponse } from "next/server";
import { fetchNews } from "@/lib/finnhub";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  try {
    const { ticker } = await params;
    const data = await fetchNews(ticker);
    return NextResponse.json(data ?? [], {
      headers: { "Cache-Control": "max-age=3600" },
    });
  } catch (err) {
    console.error("GET /api/news error:", err);
    return NextResponse.json([], {
      headers: { "Cache-Control": "no-store" },
    });
  }
}
