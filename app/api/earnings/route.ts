import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

// v3 pattern — same as lib/yahooFinance.ts. Muting the first-use notices that
// otherwise print once per process.
const yahooFinance = new YahooFinance({
  validation: { logErrors: false },
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});

type EarningsItem = {
  ticker: string;
  date: string;
  time: "bmo" | "amc" | null;
  epsEstimate: number | null;
  name: string | null;
};

function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function numOrNull(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v;
}

function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tickersParam = searchParams.get("tickers");
  if (!tickersParam) {
    return NextResponse.json({ earnings: [] });
  }

  const tickers = tickersParam
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);
  if (tickers.length === 0) {
    return NextResponse.json({ earnings: [] });
  }

  // Date window: today through +7 days.
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  end.setHours(23, 59, 59, 999);

  // N+1 fetch — Yahoo has no batched earnings calendar in this client.
  // Process in chunks: parallelizing 15+ requests at once causes Yahoo to
  // silently drop most of them. CONCURRENCY=4 completes every ticker.
  const CONCURRENCY = 4;
  const settled: PromiseSettledResult<EarningsItem | null>[] = [];

  for (let i = 0; i < tickers.length; i += CONCURRENCY) {
    const chunk = tickers.slice(i, i + CONCURRENCY);
    const chunkResults = await Promise.allSettled(
      chunk.map(async (ticker): Promise<EarningsItem | null> => {
        try {
          const data = await yahooFinance.quoteSummary(ticker, {
            modules: ["calendarEvents", "price"],
          });

          // earningsDate is sometimes a single ISO date, sometimes a 2-element
          // range; the first element is the expected reporting date.
          const earningsDates = data?.calendarEvents?.earnings?.earningsDate;
          if (!Array.isArray(earningsDates) || earningsDates.length === 0) {
            return null;
          }

          const raw = earningsDates[0];
          const earningsDate = raw instanceof Date ? raw : new Date(raw);
          if (Number.isNaN(earningsDate.getTime())) return null;

          if (earningsDate < start || earningsDate > end) return null;

          // BMO/AMC inference from UTC hour:
          //   12–15 UTC ≈ 8–11 AM ET (before market open)
          //   20+  UTC ≈ 4 PM ET onwards (after market close)
          const utcHour = earningsDate.getUTCHours();
          let time: "bmo" | "amc" | null = null;
          if (utcHour >= 12 && utcHour < 16) time = "bmo";
          else if (utcHour >= 20 || utcHour < 4) time = "amc";

          const epsEstimate = numOrNull(
            data?.calendarEvents?.earnings?.earningsAverage,
          );
          const name =
            strOrNull(data?.price?.shortName) ??
            strOrNull(data?.price?.longName);

          return {
            ticker,
            date: formatDate(earningsDate),
            time,
            epsEstimate,
            name,
          };
        } catch (err) {
          console.warn(
            `Yahoo earnings fetch failed for ${ticker}:`,
            err instanceof Error ? err.message : err,
          );
          return null;
        }
      }),
    );
    settled.push(...chunkResults);
  }

  const earnings: EarningsItem[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled" && r.value !== null) {
      earnings.push(r.value);
    }
  }
  earnings.sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({ earnings });
}
