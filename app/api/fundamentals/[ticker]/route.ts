import { NextResponse } from "next/server";
import { fetchFundamentals } from "@/lib/fmp";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  try {
    const { ticker } = await params;
    console.log("GET /api/fundamentals ticker:", ticker);
    const result = await fetchFundamentals(ticker);
    console.log("Sending fundamentals:", JSON.stringify(result));
    return NextResponse.json(result ?? {});
  } catch (err) {
    console.error("GET /api/fundamentals error:", err);
    return NextResponse.json({});
  }
}
