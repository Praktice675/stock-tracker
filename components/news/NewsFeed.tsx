"use client";

import { useEffect, useMemo, useState } from "react";

type NewsItem = {
  uuid: string;
  title: string;
  publisher: string;
  link: string;
  timestamp: number;
  ticker: string;
  summary?: string;
};

type Props = {
  watchlistTickers: string[];
};

type TickerColor = { fill: string; text: string; solid: string };

// Cycle by watchlist position. Position 7+ falls back to neutral.
const TICKER_COLORS: TickerColor[] = [
  { fill: "rgba(255, 107, 26, 0.15)", text: "#ff6b3d", solid: "#ff6b3d" }, // orange
  { fill: "rgba(59, 130, 246, 0.15)", text: "#3B82F6", solid: "#3B82F6" }, // blue
  { fill: "rgba(0, 208, 132, 0.15)", text: "#00D084", solid: "#00D084" }, // green
  { fill: "rgba(168, 85, 247, 0.15)", text: "#A855F7", solid: "#A855F7" }, // purple
  { fill: "rgba(245, 158, 11, 0.15)", text: "#F59E0B", solid: "#F59E0B" }, // amber
  { fill: "rgba(236, 72, 153, 0.15)", text: "#EC4899", solid: "#EC4899" }, // pink
  { fill: "rgba(20, 184, 166, 0.15)", text: "#14B8A6", solid: "#14B8A6" }, // teal
  { fill: "rgba(113, 113, 122, 0.18)", text: "#A1A1AA", solid: "#71717A" }, // neutral
];

const ALL_COLOR = TICKER_COLORS[0];

function tickerColor(ticker: string, watchlist: string[]): TickerColor {
  const idx = watchlist.indexOf(ticker);
  if (idx === -1) return TICKER_COLORS[TICKER_COLORS.length - 1];
  return TICKER_COLORS[Math.min(idx, TICKER_COLORS.length - 1)];
}

function relativeTime(unixSec: number): string {
  const diff = Date.now() / 1000 - unixSec;
  if (diff < 60) return "Just now";
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    return m === 1 ? "1 minute ago" : `${m} minutes ago`;
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return h === 1 ? "1 hour ago" : `${h} hours ago`;
  }
  if (diff < 86400 * 7) {
    const d = Math.floor(diff / 86400);
    return d === 1 ? "1 day ago" : `${d} days ago`;
  }
  return new Date(unixSec * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function NewsFeed({ watchlistTickers }: Props) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const tickersKey = watchlistTickers.join(",");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`/api/news?tickers=${encodeURIComponent(tickersKey)}`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : { news: [] }))
      .then((d) => {
        if (!cancelled) setNews(Array.isArray(d?.news) ? d.news : []);
      })
      .catch((err) => {
        console.warn("news fetch failed:", err);
        if (!cancelled) setNews([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tickersKey]);

  const filtered = useMemo(() => {
    if (!selectedTicker) return news;
    return news.filter((n) => n.ticker === selectedTicker);
  }, [news, selectedTicker]);

  return (
    <div
      className="mx-auto w-full"
      style={{ maxWidth: "1280px", padding: "0 24px" }}
    >
      <div className="flex flex-col" style={{ gap: "18px" }}>
        <header>
          <h1
            className="font-mono uppercase"
            style={{
              fontSize: "13px",
              fontWeight: 700,
              letterSpacing: "0.25em",
              color: "var(--text-muted)",
              margin: 0,
              marginBottom: "6px",
            }}
          >
            News
          </h1>
          <p
            className="text-text-muted"
            style={{
              fontSize: "12px",
              letterSpacing: "-0.015em",
              margin: 0,
            }}
          >
            Latest news from your watchlist
          </p>
        </header>

        <FilterChips
          tickers={watchlistTickers}
          selected={selectedTicker}
          onSelect={setSelectedTicker}
        />

        {loading ? (
          <NewsGridSkeleton />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.length === 0 ? (
              <div className="col-span-full">
                <EmptyFiltered
                  ticker={selectedTicker}
                  onClear={() => setSelectedTicker(null)}
                />
              </div>
            ) : (
              filtered.map((item) => (
                <CompactCard
                  key={item.uuid}
                  item={item}
                  color={tickerColor(item.ticker, watchlistTickers)}
                  onClickTicker={(t) => setSelectedTicker(t)}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterChips({
  tickers,
  selected,
  onSelect,
}: {
  tickers: string[];
  selected: string | null;
  onSelect: (t: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap" style={{ gap: "8px" }}>
      <Chip
        label="ALL"
        active={selected === null}
        color={ALL_COLOR}
        onClick={() => onSelect(null)}
      />
      {tickers.map((t) => (
        <Chip
          key={t}
          label={t}
          active={selected === t}
          color={tickerColor(t, tickers)}
          onClick={() => onSelect(t)}
        />
      ))}
    </div>
  );
}

function Chip({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color: TickerColor;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-mono uppercase transition-colors duration-150 hover:border-[#3f3f46]"
      style={{
        padding: "4px 10px",
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.18em",
        backgroundColor: active ? color.solid : "transparent",
        color: active ? "rgb(var(--color-black))" : "#A1A1AA",
        border: active
          ? `1px solid ${color.solid}`
          : "1px solid #27272a",
        borderRadius: "var(--border-radius)",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function TickerPill({
  ticker,
  color,
  onClick,
}: {
  ticker: string;
  color: TickerColor;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className="font-mono font-semibold uppercase transition-opacity hover:opacity-80"
      style={{
        padding: "2px 6px",
        fontSize: "10.5px",
        letterSpacing: "0.12em",
        backgroundColor: color.fill,
        color: color.text,
        border: "none",
        borderRadius: "2px",
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      {ticker}
    </button>
  );
}

function CompactCard({
  item,
  color,
  onClickTicker,
}: {
  item: NewsItem;
  color: TickerColor;
  onClickTicker: (t: string) => void;
}) {
  return (
    <article
      className="transition-colors duration-150 hover:border-[#3f3f46]"
      style={{
        backgroundColor: "#131114",
        border: "1px solid #27272a",
        borderRadius: "var(--border-radius)",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      {/* Row 1: meta */}
      <div
        className="flex items-center"
        style={{ gap: "8px", flexWrap: "nowrap", minWidth: 0 }}
      >
        <TickerPill
          ticker={item.ticker}
          color={color}
          onClick={() => onClickTicker(item.ticker)}
        />
        <span
          className="font-mono"
          style={{
            fontSize: "11px",
            letterSpacing: "0.04em",
            color: "#A1A1AA",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
            flex: "0 1 auto",
          }}
        >
          {item.publisher || "Unknown"}
        </span>
        <span
          className="font-mono"
          style={{
            fontSize: "11px",
            letterSpacing: "0.04em",
            color: "#71717A",
            flexShrink: 0,
            marginLeft: "auto",
          }}
        >
          {relativeTime(item.timestamp)}
        </span>
      </div>

      {/* Row 2: headline */}
      <a
        href={item.link}
        target="_blank"
        rel="noopener noreferrer"
        className="text-text-primary transition-colors duration-150 hover:text-accent line-clamp-3 leading-snug"
        style={{
          fontSize: "14.5px",
          fontWeight: 500,
          letterSpacing: "-0.015em",
          textDecoration: "none",
          display: "block",
        }}
      >
        {item.title}
      </a>

      {/* Row 3: excerpt */}
      {item.summary && (
        <p
          className="line-clamp-2"
          style={{
            fontSize: "12.5px",
            lineHeight: 1.5,
            letterSpacing: "-0.01em",
            color: "#A1A1AA",
            margin: 0,
          }}
        >
          {item.summary}
        </p>
      )}

      {/* Row 4: read more */}
      <div
        className="flex justify-end"
        style={{ marginTop: "auto", paddingTop: "4px" }}
      >
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono uppercase transition-opacity hover:opacity-80"
          style={{
            fontSize: "11px",
            letterSpacing: "0.18em",
            color: "var(--accent)",
            textDecoration: "none",
          }}
        >
          Read more →
        </a>
      </div>
    </article>
  );
}

function EmptyFiltered({
  ticker,
  onClear,
}: {
  ticker: string | null;
  onClear: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{ padding: "64px 0", gap: "12px" }}
    >
      <p
        style={{
          fontSize: "13px",
          letterSpacing: "-0.015em",
          color: "#A1A1AA",
          margin: 0,
        }}
      >
        {ticker
          ? `No recent news for ${ticker}.`
          : "No recent news for any watchlist ticker."}
      </p>
      {ticker && (
        <button
          type="button"
          onClick={onClear}
          className="font-mono uppercase transition-opacity hover:opacity-80"
          style={{
            fontSize: "10px",
            letterSpacing: "0.2em",
            color: "var(--accent)",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          Clear filter →
        </button>
      )}
    </div>
  );
}

function NewsGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse"
          style={{
            backgroundColor: "#131114",
            border: "1px solid #27272a",
            borderRadius: "var(--border-radius)",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div
            className="flex"
            style={{ gap: "8px", justifyContent: "space-between" }}
          >
            <div className="flex" style={{ gap: "8px" }}>
              <SkelBar width={42} height={14} />
              <SkelBar width={70} height={12} />
            </div>
            <SkelBar width={56} height={12} />
          </div>
          <SkelBar width="95%" height={15} />
          <SkelBar width="80%" height={15} />
          <SkelBar width="100%" height={12} />
          <SkelBar width="60%" height={12} />
          <div className="flex justify-end" style={{ marginTop: "auto" }}>
            <SkelBar width={68} height={11} />
          </div>
        </div>
      ))}
    </div>
  );
}

function SkelBar({
  width,
  height,
}: {
  width: number | string;
  height: number;
}) {
  return (
    <div
      style={{
        width,
        height,
        backgroundColor: "rgb(var(--color-grey-800))",
        borderRadius: "2px",
      }}
    />
  );
}
