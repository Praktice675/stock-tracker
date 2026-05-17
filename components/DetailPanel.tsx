"use client";

import { useEffect, useState } from "react";

type Stat = { label: string; value: string };
type Rating = { label: string; pct: number; color: string };
type NewsItem = { headline: string; source: string; time: string };

type Fundamentals = {
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

const MUTED_BAR = "rgb(var(--color-grey-300))";
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

const formatDivYield = (n: number | null): string =>
  n == null || n === 0 ? "N/A" : `${n.toFixed(2)}%`;

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

function buildStats(f: Fundamentals): Stat[] {
  return [
    { label: "Market Cap", value: formatMarketCap(f.marketCap) },
    { label: "P/E Ratio", value: formatPE(f.pe) },
    { label: "EPS", value: formatEPS(f.eps) },
    { label: "Revenue", value: formatRevenue(f.revenue) },
    { label: "52W High", value: formatPrice(f.high52) },
    { label: "52W Low", value: formatPrice(f.low52) },
    { label: "Avg Volume", value: formatVolume(f.avgVolume) },
    { label: "Beta", value: formatBeta(f.beta) },
    { label: "Div Yield", value: formatDivYield(f.divYield) },
    { label: "Float", value: formatFloat(f.float) },
  ];
}

function buildRatings(f: Fundamentals | null): Rating[] {
  const buy = f?.analystBuy ?? 0;
  const hold = f?.analystHold ?? 0;
  const sell = f?.analystSell ?? 0;
  return [
    { label: "Buy", pct: buy, color: "#00FF94" },
    { label: "Hold", pct: hold, color: MUTED_BAR },
    { label: "Sell", pct: sell, color: "#FF3B5C" },
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
  const [fundamentals, setFundamentals] = useState<Fundamentals | null>(null);
  const [news, setNews] = useState<NewsItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFundamentals(null);
    setNews(null);

    Promise.all([
      fetch(`/api/fundamentals/${selectedTicker}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : {}))
        .catch((err) => {
          console.warn(`Fundamentals fetch for ${selectedTicker} failed:`, err);
          return {};
        }),
      fetch(`/api/news/${selectedTicker}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : []))
        .catch((err) => {
          console.warn(`News fetch for ${selectedTicker} failed:`, err);
          return [];
        }),
    ]).then(([fund, articles]) => {
      if (cancelled) return;

      console.log("Fundamentals received:", fund);
      console.log(
        "Fundamentals keys:",
        fund && typeof fund === "object" ? Object.keys(fund) : "(not an object)",
      );

      const hasFund =
        fund && typeof fund === "object" && Object.keys(fund).length > 0;
      setFundamentals(hasFund ? (fund as Fundamentals) : null);
      setNews(Array.isArray(articles) ? articles : []);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedTicker]);

  const stats = loading
    ? buildLoadingStats()
    : fundamentals
      ? buildStats(fundamentals)
      : buildLoadingStats();

  const ratings = buildRatings(loading ? null : fundamentals);

  const displayName = loading
    ? PLACEHOLDER
    : (fundamentals?.companyName ?? selectedTicker);
  const displaySector = loading ? PLACEHOLDER : (fundamentals?.sector ?? "—");
  const displayExchange = loading
    ? PLACEHOLDER
    : (fundamentals?.exchange ?? "—");

  const range = {
    low: fundamentals?.low52 ?? null,
    current: fundamentals?.price ?? null,
    high: fundamentals?.high52 ?? null,
  };

  const newsToShow: NewsItem[] =
    loading || news == null
      ? loadingNews()
      : news.length > 0
        ? news
        : loadingNews();

  return (
    <div className="flex h-full flex-col">
      <Header
        name={displayName}
        sector={displaySector}
        exchange={displayExchange}
        ticker={selectedTicker}
      />
      <StatsGrid stats={stats} />
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
    <section
      style={{ padding: "16px", borderBottom: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-2">
        <span
          className="text-text-primary font-bold"
          style={{ fontSize: "14px", letterSpacing: "-0.015em" }}
        >
          {name}
        </span>
        <span
          className="text-text-muted"
          style={{
            fontSize: "10px",
            padding: "2px 8px",
            backgroundColor: "rgb(var(--color-grey-800))",
            borderRadius: "var(--border-radius)",
            letterSpacing: "-0.015em",
          }}
        >
          {sector}
        </span>
      </div>
      <div
        className="text-text-muted font-mono"
        style={{ fontSize: "10px", marginTop: "6px", letterSpacing: "-0.015em" }}
      >
        {exchange}: {ticker}
      </div>
    </section>
  );
}

function StatsGrid({ stats }: { stats: Stat[] }) {
  return (
    <section
      style={{ padding: "16px", borderBottom: "1px solid var(--border)" }}
    >
      <div className="grid grid-cols-2 gap-x-4">
        {stats.map((stat) => (
          <div key={stat.label} style={{ paddingBottom: "16px" }}>
            <div
              className="text-text-muted uppercase"
              style={{ fontSize: "9px", letterSpacing: "0.18em" }}
            >
              {stat.label}
            </div>
            <div
              className="text-text-primary font-mono"
              style={{
                fontSize: "13px",
                letterSpacing: "-0.015em",
                marginTop: "4px",
              }}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>
    </section>
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
    <section
      style={{ padding: "16px", borderBottom: "1px solid var(--border)" }}
    >
      <div
        className="text-text-muted uppercase"
        style={{ fontSize: "9px", letterSpacing: "0.18em" }}
      >
        52W Range
      </div>

      <div
        style={{
          position: "relative",
          height: "3px",
          marginTop: "16px",
          marginBottom: "16px",
          backgroundColor: "rgb(var(--color-grey-800))",
          borderRadius: "var(--border-radius)",
        }}
      >
        {haveBounds && haveCurrent && (
          <>
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                height: "100%",
                width: `${pct}%`,
                backgroundColor: "rgb(var(--color-orange))",
                borderRadius: "var(--border-radius)",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: `${pct}%`,
                width: "10px",
                height: "10px",
                transform: "translate(-50%, -50%)",
                backgroundColor: "rgb(var(--color-orange))",
                borderRadius: "9999px",
                boxShadow: "0 0 0 2px rgb(var(--color-black))",
              }}
            />
          </>
        )}
      </div>

      <div className="flex justify-between">
        <span
          className="text-text-muted font-mono"
          style={{ fontSize: "9px", letterSpacing: "-0.015em" }}
        >
          {range.low != null ? `$${range.low.toFixed(2)}` : PLACEHOLDER}
        </span>
        <span
          className="text-text-muted font-mono"
          style={{ fontSize: "9px", letterSpacing: "-0.015em" }}
        >
          {range.high != null ? `$${range.high.toFixed(2)}` : PLACEHOLDER}
        </span>
      </div>
    </section>
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
    <section
      style={{ padding: "16px", borderBottom: "1px solid var(--border)" }}
    >
      <div
        className="text-text-muted uppercase"
        style={{
          fontSize: "9px",
          letterSpacing: "0.18em",
          marginBottom: "12px",
        }}
      >
        Analyst Ratings
      </div>

      <div className="flex flex-col" style={{ gap: "10px" }}>
        {ratings.map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <span
              className="text-text-muted"
              style={{
                fontSize: "10px",
                width: "32px",
                letterSpacing: "-0.015em",
              }}
            >
              {r.label}
            </span>
            <div
              className="flex-1"
              style={{
                position: "relative",
                height: "3px",
                backgroundColor: "rgb(var(--color-grey-800))",
                borderRadius: "var(--border-radius)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  height: "100%",
                  width: `${r.pct}%`,
                  backgroundColor: r.color,
                  borderRadius: "var(--border-radius)",
                }}
              />
            </div>
            <span
              className="text-text-primary font-mono"
              style={{
                fontSize: "10px",
                width: "32px",
                textAlign: "right",
                letterSpacing: "-0.015em",
              }}
            >
              {loading ? PLACEHOLDER : `${Math.round(r.pct)}%`}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function LatestNews({ news }: { news: NewsItem[] }) {
  return (
    <section style={{ padding: "16px" }}>
      <div
        className="text-text-muted uppercase"
        style={{
          fontSize: "9px",
          letterSpacing: "0.18em",
          marginBottom: "12px",
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
              className="text-text-primary line-clamp-2 transition-colors duration-150 ease-brand group-hover:text-accent"
              style={{
                fontSize: "11px",
                lineHeight: 1.4,
                letterSpacing: "-0.015em",
                margin: 0,
                fontWeight: 500,
              }}
            >
              {n.headline}
            </h3>
            <div
              className="text-text-muted"
              style={{
                fontSize: "9px",
                marginTop: "6px",
                letterSpacing: "-0.015em",
              }}
            >
              {n.source}
              {n.time ? ` · ${n.time}` : ""}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
