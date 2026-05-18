"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";

type Stat = { label: string; value: string };
type Rating = { label: string; pct: number; barColor: string };
type NewsItem = { headline: string; source: string; time: string };

type Stats = {
  name: string | null;
  sector: string | null;
  exchange: string | null;
  currentPrice: number | null;
  marketCap: number | null;
  peRatio: number | null;
  eps: number | null;
  revenue: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  avgVolume: number | null;
  beta: number | null;
  dividendYield: number | null; // fraction 0–1 from Yahoo
  floatShares: number | null;
  analystRatings: {
    buy: number;
    hold: number;
    sell: number;
    totalAnalysts: number;
  } | null;
};

const PLACEHOLDER = "—";

const formatMarketCap = (n: number | null): string =>
  n == null
    ? PLACEHOLDER
    : n >= 1e12
      ? `$${(n / 1e12).toFixed(2)}T`
      : `$${(n / 1e9).toFixed(1)}B`;

const formatVolume = (n: number | null): string =>
  n == null ? PLACEHOLDER : `${(n / 1e6).toFixed(1)}M`;

const formatRevenue = (n: number | null): string =>
  n == null
    ? PLACEHOLDER
    : n >= 1e12
      ? `$${(n / 1e12).toFixed(1)}T`
      : `$${(n / 1e9).toFixed(1)}B`;

const formatPE = (n: number | null): string =>
  n == null || n <= 0 ? "N/A" : `${n.toFixed(1)}x`;

const formatEPS = (n: number | null): string =>
  n == null ? PLACEHOLDER : `$${n.toFixed(2)}`;

const formatPrice = (n: number | null): string =>
  n == null ? PLACEHOLDER : `$${n.toFixed(2)}`;

const formatBeta = (n: number | null): string =>
  n == null ? PLACEHOLDER : n.toFixed(2);

const formatDivYield = (n: number | null): string => {
  if (n == null || n === 0) return "N/A";
  // Yahoo returns dividend yield as a fraction (0.0234 = 2.34%).
  return `${(n * 100).toFixed(2)}%`;
};

const formatFloat = (n: number | null): string =>
  n == null
    ? PLACEHOLDER
    : n >= 1e9
      ? `${(n / 1e9).toFixed(1)}B`
      : `${(n / 1e6).toFixed(1)}M`;

function buildLoadingStats(): Stat[] {
  return [
    { label: "Market Cap", value: PLACEHOLDER },
    { label: "P/E Ratio", value: PLACEHOLDER },
    { label: "EPS", value: PLACEHOLDER },
    { label: "Revenue", value: PLACEHOLDER },
    { label: "52W High", value: PLACEHOLDER },
    { label: "52W Low", value: PLACEHOLDER },
    { label: "Avg Volume", value: PLACEHOLDER },
    { label: "Beta", value: PLACEHOLDER },
    { label: "Div Yield", value: PLACEHOLDER },
    { label: "Float", value: PLACEHOLDER },
  ];
}

function buildStats(f: Stats): Stat[] {
  return [
    { label: "Market Cap", value: formatMarketCap(f.marketCap) },
    { label: "P/E Ratio", value: formatPE(f.peRatio) },
    { label: "EPS", value: formatEPS(f.eps) },
    { label: "Revenue", value: formatRevenue(f.revenue) },
    { label: "52W High", value: formatPrice(f.fiftyTwoWeekHigh) },
    { label: "52W Low", value: formatPrice(f.fiftyTwoWeekLow) },
    { label: "Avg Volume", value: formatVolume(f.avgVolume) },
    { label: "Beta", value: formatBeta(f.beta) },
    { label: "Div Yield", value: formatDivYield(f.dividendYield) },
    { label: "Float", value: formatFloat(f.floatShares) },
  ];
}

function buildRatings(f: Stats | null): Rating[] {
  const r = f?.analystRatings;
  // Yahoo returns 0–1 fractions; bar widths need 0–100.
  const buy = (r?.buy ?? 0) * 100;
  const hold = (r?.hold ?? 0) * 100;
  const sell = (r?.sell ?? 0) * 100;
  return [
    { label: "Buy", pct: buy, barColor: "var(--accent-green)" },
    { label: "Hold", pct: hold, barColor: "var(--text-muted)" },
    { label: "Sell", pct: sell, barColor: "var(--accent-red)" },
  ];
}

function loadingNews(): NewsItem[] {
  return [
    { headline: PLACEHOLDER, source: PLACEHOLDER, time: "" },
    { headline: PLACEHOLDER, source: PLACEHOLDER, time: "" },
    { headline: PLACEHOLDER, source: PLACEHOLDER, time: "" },
  ];
}

type Props = {
  selectedTicker: string;
};

export default function DetailPanel({ selectedTicker }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [news, setNews] = useState<NewsItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setStats(null);
    setNews(null);

    Promise.all([
      fetch(`/api/stats/${selectedTicker}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .catch((err) => {
          console.warn(`Stats fetch for ${selectedTicker} failed:`, err);
          return null;
        }),
      fetch(`/api/news/${selectedTicker}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : []))
        .catch((err) => {
          console.warn(`News fetch for ${selectedTicker} failed:`, err);
          return [];
        }),
    ]).then(([s, articles]) => {
      if (cancelled) return;

      const hasStats =
        s &&
        typeof s === "object" &&
        !("error" in s) &&
        Object.keys(s).length > 0;
      setStats(hasStats ? (s as Stats) : null);
      setNews(Array.isArray(articles) ? articles : []);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedTicker]);

  const statsRows = loading
    ? buildLoadingStats()
    : stats
      ? buildStats(stats)
      : buildLoadingStats();

  const ratings = buildRatings(loading ? null : stats);

  const displayName = loading
    ? PLACEHOLDER
    : (stats?.name ?? selectedTicker);
  const displaySector = loading ? PLACEHOLDER : (stats?.sector ?? "—");
  const displayExchange = loading ? PLACEHOLDER : (stats?.exchange ?? "—");

  const range = {
    low: stats?.fiftyTwoWeekLow ?? null,
    current: stats?.currentPrice ?? null,
    high: stats?.fiftyTwoWeekHigh ?? null,
  };

  const newsToShow: NewsItem[] =
    loading || news == null
      ? loadingNews()
      : news.length > 0
        ? news
        : loadingNews();

  return (
    <div className="flex flex-col" style={{ gap: "12px" }}>
      <Header
        name={displayName}
        sector={displaySector}
        exchange={displayExchange}
        ticker={selectedTicker}
      />
      <StatsGrid stats={statsRows} />
      <PerformanceRange range={range} />
      <AnalystRatings ratings={ratings} loading={loading} />
      <LatestNews news={newsToShow} />
    </div>
  );
}

function Header({
  name,
  sector,
  exchange,
  ticker,
}: {
  name: string;
  sector: string;
  exchange: string;
  ticker: string;
}) {
  return (
    <Card padding="20px">
      <div className="flex items-center gap-2">
        <span
          className="font-bold"
          style={{
            fontSize: "14px",
            letterSpacing: "-0.015em",
            color: "var(--text-primary)",
          }}
        >
          {name}
        </span>
        <span
          style={{
            fontSize: "10px",
            padding: "2px 8px",
            backgroundColor: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            letterSpacing: "-0.015em",
            color: "var(--text-muted)",
          }}
        >
          {sector}
        </span>
      </div>
      <div
        className="font-mono"
        style={{
          fontSize: "10px",
          marginTop: "6px",
          letterSpacing: "-0.015em",
          color: "var(--text-muted)",
        }}
      >
        {exchange}: {ticker}
      </div>
    </Card>
  );
}

function StatsGrid({ stats }: { stats: Stat[] }) {
  return (
    <Card padding="20px">
      <div className="flex flex-col">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className="flex items-center justify-between"
            style={{
              padding: "10px 0",
              borderBottom:
                i < stats.length - 1 ? "1px solid var(--border)" : "none",
            }}
          >
            <span
              className="font-mono uppercase"
              style={{
                fontSize: "10px",
                letterSpacing: "0.18em",
                color: "var(--text-muted)",
              }}
            >
              {stat.label}
            </span>
            <span
              className="font-mono"
              style={{
                fontSize: "13px",
                fontWeight: 600,
                letterSpacing: "-0.015em",
                color: "var(--text-primary)",
              }}
            >
              {stat.value}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PerformanceRange({
  range,
}: {
  range: { low: number | null; current: number | null; high: number | null };
}) {
  const haveBounds =
    range.low != null && range.high != null && range.high > range.low;
  const haveCurrent = range.current != null;

  let pct = 0;
  if (haveBounds && haveCurrent) {
    const span = (range.high as number) - (range.low as number);
    pct = (((range.current as number) - (range.low as number)) / span) * 100;
    pct = Math.max(0, Math.min(100, pct));
  }

  return (
    <Card padding="20px">
      <div
        className="font-mono uppercase"
        style={{
          fontSize: "10px",
          letterSpacing: "0.25em",
          marginBottom: "16px",
          color: "var(--text-muted)",
        }}
      >
        52W Range
      </div>

      <div
        style={{
          position: "relative",
          height: "6px",
          width: "100%",
          backgroundColor: "var(--bg-surface)",
          borderRadius: "3px",
          backgroundImage:
            "linear-gradient(to right, var(--accent-green), var(--accent-red))",
        }}
      >
        {haveBounds && haveCurrent && (
          <div
            aria-label="current price"
            style={{
              position: "absolute",
              top: "50%",
              left: `${pct}%`,
              width: "2px",
              height: "12px",
              transform: "translate(-50%, -50%)",
              backgroundColor: "var(--text-primary)",
            }}
          />
        )}
      </div>

      <div
        className="flex justify-between"
        style={{ paddingTop: "8px" }}
      >
        <span
          className="font-mono"
          style={{
            fontSize: "11px",
            letterSpacing: "-0.015em",
            color: "var(--text-muted)",
          }}
        >
          {range.low != null ? `$${range.low.toFixed(2)}` : PLACEHOLDER}
        </span>
        <span
          className="font-mono"
          style={{
            fontSize: "11px",
            letterSpacing: "-0.015em",
            color: "var(--text-muted)",
          }}
        >
          {range.high != null ? `$${range.high.toFixed(2)}` : PLACEHOLDER}
        </span>
      </div>
    </Card>
  );
}

function AnalystRatings({
  ratings,
  loading,
}: {
  ratings: Rating[];
  loading: boolean;
}) {
  return (
    <Card padding="20px">
      <div
        className="font-mono uppercase"
        style={{
          fontSize: "10px",
          letterSpacing: "0.25em",
          marginBottom: "12px",
          color: "var(--text-muted)",
        }}
      >
        Analyst Ratings
      </div>

      <div className="flex flex-col" style={{ gap: "10px" }}>
        {ratings.map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <span
              style={{
                fontSize: "10px",
                width: "32px",
                letterSpacing: "-0.015em",
                color: "var(--text-muted)",
              }}
            >
              {r.label}
            </span>
            <div
              className="flex-1"
              style={{
                position: "relative",
                height: "4px",
                backgroundColor: "var(--bg-surface)",
                borderRadius: "2px",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  height: "100%",
                  width: `${r.pct}%`,
                  backgroundColor: r.barColor,
                  borderRadius: "2px",
                }}
              />
            </div>
            <span
              className="font-mono"
              style={{
                fontSize: "10px",
                width: "32px",
                textAlign: "right",
                letterSpacing: "-0.015em",
                color: "var(--text-primary)",
              }}
            >
              {loading ? PLACEHOLDER : `${Math.round(r.pct)}%`}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function LatestNews({ news }: { news: NewsItem[] }) {
  return (
    <Card padding="20px">
      <div
        className="font-mono uppercase"
        style={{
          fontSize: "10px",
          letterSpacing: "0.25em",
          marginBottom: "12px",
          color: "var(--text-muted)",
        }}
      >
        Latest News
      </div>

      <div className="flex flex-col">
        {news.map((n, i) => (
          <article
            key={`${i}-${n.headline}`}
            className="group cursor-pointer"
            style={{
              padding: "10px 0",
              borderBottom:
                i < news.length - 1 ? "1px solid var(--border)" : "none",
            }}
          >
            <h3
              className="line-clamp-3 transition-colors duration-150 ease-brand group-hover:text-accent"
              style={{
                fontSize: "13px",
                lineHeight: 1.4,
                letterSpacing: "-0.015em",
                margin: 0,
                fontWeight: 500,
                color: "var(--text-primary)",
              }}
            >
              {n.headline}
            </h3>
            <div
              className="font-mono uppercase"
              style={{
                fontSize: "10px",
                marginTop: "4px",
                letterSpacing: "0.05em",
                color: "var(--text-muted)",
              }}
            >
              {n.source}
              {n.time ? ` · ${n.time}` : ""}
            </div>
          </article>
        ))}
      </div>
    </Card>
  );
}
