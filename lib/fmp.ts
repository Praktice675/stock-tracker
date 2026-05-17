// FMP shut off /api/v3/* on Aug 31, 2025 with a 403 "Legacy Endpoint" message.
// New base is /stable and the symbol is a query param.
const BASE = "https://financialmodelingprep.com/stable";

export type Fundamentals = {
  marketCap: number | null;
  pe: number | null;
  eps: number | null;
  revenue: number | null;
  beta: number | null;
  divYield: number | null;
  float: number | null;
  high52: number | null;
  low52: number | null;
  avgVolume: number | null;
  sector: string | null;
  exchange: string | null;
  companyName: string | null;
  price: number | null;
  analystBuy: number | null;
  analystHold: number | null;
  analystSell: number | null;
};

function numOrNull(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v;
}

function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

export async function fetchFundamentals(
  ticker: string,
): Promise<Fundamentals | null> {
  console.log("FMP KEY EXISTS:", !!process.env.FMP_API_KEY);

  const key = process.env.FMP_API_KEY;
  if (!key) {
    console.warn("fetchFundamentals: missing FMP_API_KEY");
    return null;
  }

  try {
    const enc = encodeURIComponent(ticker);
    const profileUrl = `${BASE}/profile?symbol=${enc}&apikey=${key}`;
    const ratingsUrl = `${BASE}/ratings-snapshot?symbol=${enc}&apikey=${key}`;
    // Log without leaking the key
    console.log("FMP URL:", profileUrl.replace(key, "***"));

    const [profileRes, ratingsRes] = await Promise.all([
      fetch(profileUrl),
      fetch(ratingsUrl),
    ]);

    if (!profileRes.ok) {
      console.warn(
        `fetchFundamentals: profile HTTP ${profileRes.status} for ${ticker}`,
      );
      return null;
    }

    const profileJson = await profileRes.json();
    console.log("FMP RAW:", JSON.stringify(profileJson).slice(0, 300));

    if (!Array.isArray(profileJson) || profileJson.length === 0) {
      console.warn(
        `fetchFundamentals: profile response is not a non-empty array for ${ticker}`,
      );
      return null;
    }
    const profile = profileJson[0];
    if (!profile || typeof profile !== "object") {
      console.warn(`fetchFundamentals: empty profile[0] for ${ticker}`);
      return null;
    }

    let high52: number | null = null;
    let low52: number | null = null;
    if (typeof profile.range === "string") {
      const [loStr, hiStr] = profile.range.split("-");
      const lo = parseFloat(loStr);
      const hi = parseFloat(hiStr);
      if (Number.isFinite(lo)) low52 = lo;
      if (Number.isFinite(hi)) high52 = hi;
    }

    const price = numOrNull(profile.price);
    // New endpoint uses `lastDividend`; legacy used `lastDiv`. Accept both.
    const lastDiv = numOrNull(profile.lastDividend ?? profile.lastDiv);
    let divYield: number | null = null;
    if (lastDiv != null && lastDiv > 0 && price != null && price > 0) {
      divYield = (lastDiv / price) * 100;
    }

    // Free-tier FMP often returns nothing (or 403) for the analyst-ratings
    // endpoint — fall back to a static blend if we can't parse a real total.
    let analystBuy: number | null = null;
    let analystHold: number | null = null;
    let analystSell: number | null = null;
    if (ratingsRes.ok) {
      try {
        const ratingsJson = await ratingsRes.json();
        const rating = Array.isArray(ratingsJson) ? ratingsJson[0] : null;
        if (rating) {
          const strongBuy =
            numOrNull(rating.analystRatingsStrongBuy ?? rating.strongBuy) ?? 0;
          const buy = numOrNull(rating.analystRatingsBuy ?? rating.buy) ?? 0;
          const hold = numOrNull(rating.analystRatingsHold ?? rating.hold) ?? 0;
          const sell = numOrNull(rating.analystRatingsSell ?? rating.sell) ?? 0;
          const strongSell =
            numOrNull(rating.analystRatingsStrongSell ?? rating.strongSell) ??
            0;
          const total = strongBuy + buy + hold + sell + strongSell;
          if (total > 0) {
            analystBuy = ((strongBuy + buy) / total) * 100;
            analystHold = (hold / total) * 100;
            analystSell = ((sell + strongSell) / total) * 100;
          }
        }
      } catch (err) {
        console.warn("fetchFundamentals: ratings parse failed:", err);
      }
    } else {
      console.warn(
        `fetchFundamentals: ratings HTTP ${ratingsRes.status} for ${ticker} (likely free-tier restriction)`,
      );
    }
    if (analystBuy == null || analystHold == null || analystSell == null) {
      console.warn(
        `fetchFundamentals: using analyst-ratings fallback for ${ticker}`,
      );
      analystBuy = 70;
      analystHold = 20;
      analystSell = 10;
    }

    return {
      // New endpoint uses `marketCap`; legacy used `mktCap`.
      marketCap: numOrNull(profile.marketCap ?? profile.mktCap),
      pe: numOrNull(profile.pe),
      eps: numOrNull(profile.eps),
      revenue: numOrNull(profile.revenue),
      beta: numOrNull(profile.beta),
      divYield,
      float: numOrNull(profile.floatShares ?? profile.float),
      high52,
      low52,
      // New endpoint exposes `averageVolume` natively.
      avgVolume: numOrNull(profile.averageVolume ?? profile.volAvg),
      sector: strOrNull(profile.sector),
      // New endpoint uses `exchange` directly; legacy used `exchangeShortName`.
      exchange: strOrNull(profile.exchange ?? profile.exchangeShortName),
      companyName: strOrNull(profile.companyName),
      price,
      analystBuy,
      analystHold,
      analystSell,
    };
  } catch (err) {
    console.error(
      `fetchFundamentals: error for ${ticker}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
