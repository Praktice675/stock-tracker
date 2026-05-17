import { NextResponse } from "next/server";
import { fetchYahooSearch } from "@/lib/yahooFinance";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    if (q.length === 0) {
      return NextResponse.json([]);
    }
    const results = await fetchYahooSearch(q);
    return NextResponse.json(results);
  } catch (err) {
    console.error("GET /api/search error:", err);
    return NextResponse.json([]);
  }
}
