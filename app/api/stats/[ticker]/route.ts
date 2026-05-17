import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

// Match the existing yahoo-finance2 v3 instance shape from lib/yahooFinance.ts.
const yf = new YahooFinance({
  validation: { logErrors: false },
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});

export const dynamic = "force-dynamic";

// yahoo-finance2 ships strict module-shaped types; some fields we read have
// platform-specific quirks (exchangeName is on `price` but lives in different
// keys across symbol types). Treat the response as an unknown record for the
// few lookups that are noisy under strict typing.
type AnyRec = Record<string, unknown>;

function numOrNull(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v;
}

function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;

  try {
    const data = await yf.quoteSummary(ticker, {
      modules: [
        "summaryDetail",
        "defaultKeyStatistics",
        "financialData",
        "price",
        "recommendationTrend",
        "assetProfile",
      ],
    });

    const sd = (data.summaryDetail ?? {}) as AnyRec;
    const ks = (data.defaultKeyStatistics ?? {}) as AnyRec;
    const fd = (data.financialData ?? {}) as AnyRec;
    const pr = (data.price ?? {}) as AnyRec;
    const ap = (data.assetProfile ?? {}) as AnyRec;
    const trendArr = (data.recommendationTrend?.trend ?? []) as AnyRec[];
    const rt = (trendArr[0] ?? {}) as AnyRec;

    const strongBuy = numOrNull(rt.strongBuy) ?? 0;
    const buy = numOrNull(rt.buy) ?? 0;
    const hold = numOrNull(rt.hold) ?? 0;
    const sell = numOrNull(rt.sell) ?? 0;
    const strongSell = numOrNull(rt.strongSell) ?? 0;
    const total = strongBuy + buy + hold + sell + strongSell;

    return NextResponse.json({
      name:
        strOrNull(pr.shortName) ?? strOrNull(pr.longName) ?? ticker,
      sector: strOrNull(ap.sector),
      exchange:
        strOrNull(pr.exchangeName) ??
        strOrNull(pr.exchange) ??
        null,
      currentPrice:
        numOrNull(pr.regularMarketPrice) ?? numOrNull(fd.currentPrice),
      marketCap: numOrNull(sd.marketCap),
      peRatio: numOrNull(sd.trailingPE),
      eps: numOrNull(ks.trailingEps),
      revenue: numOrNull(fd.totalRevenue),
      fiftyTwoWeekHigh: numOrNull(sd.fiftyTwoWeekHigh),
      fiftyTwoWeekLow: numOrNull(sd.fiftyTwoWeekLow),
      avgVolume: numOrNull(sd.averageVolume),
      beta: numOrNull(sd.beta),
      dividendYield: numOrNull(sd.dividendYield), // fraction (0–1) — client multiplies
      floatShares: numOrNull(ks.floatShares),
      analystRatings: {
        buy: total > 0 ? (strongBuy + buy) / total : 0,
        hold: total > 0 ? hold / total : 0,
        sell: total > 0 ? (sell + strongSell) / total : 0,
        totalAnalysts: total,
      },
    });
  } catch (err) {
    console.warn(
      `Stats fetch failed for ${ticker}:`,
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
