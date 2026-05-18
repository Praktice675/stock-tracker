import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { createServiceClient } from "@/lib/supabase/service";

// Server-only. yahoo-finance2 v3 requires an instance; the bare default-export
// shape used in v2 docs throws "Call new YahooFinance() first" at runtime.
export const runtime = "nodejs";

const yahooFinance = new YahooFinance({
  validation: { logErrors: false },
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

type LogoRow = {
  logo_url: string | null;
  fetched_at: string;
};

function extractDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

// We use DuckDuckGo's `ip3` icon endpoint as the logo CDN. Clearbit's free
// logo CDN (logo.clearbit.com) has no DNS record anymore — verified during
// audit. DuckDuckGo is unauthenticated, stable, and returns favicon-tier
// images that look fine at 24–32px in the UI.
function buildLogoUrl(domain: string | null): string | null {
  if (!domain) return null;
  return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker: raw } = await params;
  const ticker = raw.toUpperCase();

  // Service role: this is a public shared cache, RLS only grants SELECT to
  // end-users (no write policy), so route writes must bypass RLS.
  const service = createServiceClient();

  // 1) Cache check
  const cacheResp = await service
    .from("ticker_logos")
    .select("logo_url, fetched_at")
    .eq("ticker", ticker)
    .maybeSingle();
  const cached = cacheResp.data as LogoRow | null;

  if (
    cached &&
    Date.now() - new Date(cached.fetched_at).getTime() < CACHE_TTL_MS
  ) {
    return NextResponse.json(
      { url: cached.logo_url },
      {
        headers: {
          "Cache-Control": "public, max-age=86400, s-maxage=86400",
        },
      },
    );
  }

  // 2) Look up website via Yahoo
  let domain: string | null = null;
  try {
    const summary = await yahooFinance.quoteSummary(ticker, {
      modules: ["assetProfile"],
    });
    const website = (
      summary?.assetProfile as { website?: string | null } | undefined
    )?.website;
    domain = extractDomain(website);
  } catch (err) {
    console.warn(
      "[logo] yahoo lookup failed for",
      ticker,
      err instanceof Error ? err.message : err,
    );
  }

  const logoUrl = buildLogoUrl(domain);

  // 3) Cache the result (even null, to avoid hammering Yahoo for tickers it
  // can't resolve — e.g. ETFs without an assetProfile.website).
  // Cast through unknown: service client has no Database generic so query
  // payloads widen to never. Same workaround used in /api/chat.
  const writeTable = service.from("ticker_logos") as unknown as {
    upsert: (
      row: Record<string, unknown>,
      opts: { onConflict: string },
    ) => Promise<{ error: { message: string } | null }>;
  };
  const { error: upsertErr } = await writeTable.upsert(
    {
      ticker,
      domain,
      logo_url: logoUrl,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "ticker" },
  );
  if (upsertErr) {
    console.warn("[logo] cache upsert failed for", ticker, upsertErr.message);
  }

  return NextResponse.json(
    { url: logoUrl },
    {
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    },
  );
}
