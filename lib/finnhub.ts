export type NewsItem = {
  headline: string;
  source: string;
  time: string;
};

type FinnhubArticle = {
  category?: string;
  datetime?: number;
  headline?: string;
  id?: number;
  source?: string;
  summary?: string;
  url?: string;
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatRelativeTime(unixSeconds: number): string {
  if (!Number.isFinite(unixSeconds) || unixSeconds <= 0) return "—";
  const diff = Math.max(0, Date.now() / 1000 - unixSeconds);
  const hours = Math.floor(diff / 3600);
  if (hours < 24) return `${Math.max(1, hours)}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export async function fetchNews(ticker: string): Promise<NewsItem[] | null> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) {
    console.warn("fetchNews: missing FINNHUB_API_KEY");
    return null;
  }

  try {
    const today = isoDate(new Date());
    const past = isoDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(
      ticker,
    )}&from=${past}&to=${today}&token=${key}`;

    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`fetchNews: HTTP ${res.status} for ${ticker}`);
      return null;
    }

    const json = await res.json();
    if (!Array.isArray(json)) {
      console.warn(`fetchNews: non-array response for ${ticker}`);
      return null;
    }

    return (json as FinnhubArticle[]).slice(0, 3).map((a) => ({
      headline: typeof a.headline === "string" && a.headline ? a.headline : "—",
      source: typeof a.source === "string" && a.source ? a.source : "—",
      time: formatRelativeTime(typeof a.datetime === "number" ? a.datetime : 0),
    }));
  } catch (err) {
    console.error(
      `fetchNews: error for ${ticker}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
