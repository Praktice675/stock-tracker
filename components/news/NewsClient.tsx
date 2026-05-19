"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  ExternalLink,
  Heart,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Card from "@/components/ui/Card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NewsTab = "all" | "holdings" | "watchlist";

type Article = {
  uuid: string;
  title: string;
  publisher: string;
  link: string;
  timestamp: number; // unix seconds
  ticker: string;
  summary?: string;
  thumbnail: string | null;
};

type TrendingTicker = {
  symbol: string;
  changePercent: number;
};

type Props = {
  initialTab: NewsTab;
  allTickers: string[];
  holdingsTickers: string[];
  watchlistTickers: string[];
};

const TRENDING_TICKER_CANDIDATES = [
  "AAPL",
  "NVDA",
  "TSLA",
  "MSFT",
  "META",
  "AMZN",
  "GOOG",
  "NFLX",
  "AMD",
  "INTC",
];

const GRID_LIMIT = 12;
const TRENDING_STORY_COUNT = 6;
const TRENDING_TICKER_COUNT = 6;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(unixSec: number): string {
  if (!Number.isFinite(unixSec) || unixSec <= 0) return "—";
  const diff = Math.max(0, Date.now() / 1000 - unixSec);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(unixSec * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function fallbackThumbStyle(): CSSProperties {
  return {
    background:
      "linear-gradient(135deg, color-mix(in srgb, var(--accent) 30%, var(--bg-elevated)), var(--bg-elevated))",
  };
}

function publisherInitial(publisher: string): string {
  const trimmed = publisher.trim();
  return (trimmed.charAt(0) || "•").toUpperCase();
}

// ---------------------------------------------------------------------------
// Top-level layout
// ---------------------------------------------------------------------------

export default function NewsClient({
  initialTab,
  allTickers,
  holdingsTickers,
  watchlistTickers,
}: Props) {
  const router = useRouter();
  const search = useSearchParams();
  const [tab, setTab] = useState<NewsTab>(initialTab);

  // Active-tab article state
  const [articles, setArticles] = useState<Article[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(true);

  // Right-rail data (independent of active tab — always general market news)
  const [trendingStories, setTrendingStories] = useState<Article[]>([]);
  const [trendingTickers, setTrendingTickers] = useState<TrendingTicker[]>(
    [],
  );

  // Local "show more" cursor — visible cards = min(articles.length, gridLimit).
  const [gridLimit, setGridLimit] = useState(GRID_LIMIT);

  // NOTE: We deliberately do NOT install a URL→state sync useEffect here.
  // A previous version did, and its `[useSearchParams()]` dep wasn't
  // referentially stable across re-renders. The effect was re-firing during
  // the same render cycle as a click-driven setTab, reading the stale URL
  // (router.replace is async), and calling setTab back to "all" — reverting
  // the user's tab pick before the fetch effect could see it. The cost of
  // dropping the sync is that browser back/forward won't restore the tab;
  // tabs only set via clicks. Acceptable trade-off until we need otherwise.

  function selectTab(next: NewsTab) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[NewsClient] selectTab →", next);
    }
    setTab(next);
    setGridLimit(GRID_LIMIT);
    // Clear the article list immediately so the user sees the tab change
    // even before the new fetch resolves. Otherwise the previous tab's
    // articles linger on screen during the fetch and the change is
    // imperceptible when ticker baskets overlap.
    setArticles([]);
    setArticlesLoading(true);
    const params = new URLSearchParams(search.toString());
    if (next === "all") params.delete("tab");
    else params.set("tab", next);
    const qs = params.toString();
    router.replace(qs ? `/dashboard/news?${qs}` : "/dashboard/news", {
      scroll: false,
    });
  }

  // Resolve the ticker list for the active tab.
  const tickersForTab = useMemo(() => {
    if (tab === "holdings") return holdingsTickers;
    if (tab === "watchlist") return watchlistTickers;
    return allTickers;
  }, [tab, allTickers, holdingsTickers, watchlistTickers]);

  // Fetch the active tab's news whenever the tab — and therefore the
  // resolved ticker list — changes.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        "[NewsClient] fetch effect | tab=",
        tab,
        "tickers=",
        tickersForTab.join(",") || "(none)",
      );
    }
    if (tickersForTab.length === 0) {
      setArticles([]);
      setArticlesLoading(false);
      return;
    }
    let cancelled = false;
    setArticlesLoading(true);
    const url = `/api/news?tickers=${encodeURIComponent(tickersForTab.join(","))}`;
    fetch(url, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { news: [] }))
      .then((d) => {
        if (cancelled) return;
        const list = Array.isArray(d?.news) ? (d.news as Article[]) : [];
        if (process.env.NODE_ENV !== "production") {
          console.log(
            "[NewsClient] fetch resolved | tab=",
            tab,
            "count=",
            list.length,
            "first title=",
            list[0]?.title?.slice(0, 60) ?? "—",
          );
        }
        setArticles(list);
      })
      .catch((err) => {
        console.warn("News fetch failed:", err);
        if (!cancelled) setArticles([]);
      })
      .finally(() => {
        if (!cancelled) setArticlesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tickersForTab, tab]);

  // Trending stories — always the "all" basket, fetched once on mount so
  // the right rail is stable as the user clicks between tabs.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/news?tickers=${encodeURIComponent(allTickers.join(","))}`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : { news: [] }))
      .then((d) => {
        if (cancelled) return;
        const list = Array.isArray(d?.news) ? (d.news as Article[]) : [];
        setTrendingStories(list.slice(0, TRENDING_STORY_COUNT));
      })
      .catch((err) => {
        console.warn("Trending stories fetch failed:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [allTickers]);

  // Trending tickers — fetch quotes for the candidate set, sort by absolute
  // % change, take the top N.
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      TRENDING_TICKER_CANDIDATES.map(async (symbol) => {
        try {
          const r = await fetch(`/api/quote/${symbol}`, {
            cache: "no-store",
          });
          if (!r.ok) return null;
          const j = await r.json();
          if (typeof j?.changePercent !== "number") return null;
          return { symbol, changePercent: j.changePercent } as TrendingTicker;
        } catch (err) {
          console.warn(`Trending quote ${symbol} failed:`, err);
          return null;
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      const valid = results.filter(
        (r): r is TrendingTicker => r !== null,
      );
      valid.sort(
        (a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent),
      );
      setTrendingTickers(valid.slice(0, TRENDING_TICKER_COUNT));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const hero = articles[0] ?? null;
  const gridArticles = articles.slice(1, 1 + gridLimit);
  const hasMore = articles.length > 1 + gridLimit;

  return (
    <>
      {/* Page header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <h1
          style={{
            fontSize: "24px",
            fontWeight: 700,
            color: "var(--text-primary)",
            margin: 0,
            letterSpacing: "-0.015em",
          }}
        >
          News
        </h1>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="News filter"
        style={{
          display: "flex",
          flexDirection: "row",
          gap: "4px",
          borderBottom: "1px solid var(--border)",
          marginBottom: "28px",
        }}
      >
        <TabButton
          label="All"
          active={tab === "all"}
          onClick={() => selectTab("all")}
        />
        <TabButton
          label="My Holdings"
          active={tab === "holdings"}
          onClick={() => selectTab("holdings")}
        />
        <TabButton
          label="Watchlist"
          active={tab === "watchlist"}
          onClick={() => selectTab("watchlist")}
        />
      </div>

      {/* Main grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 320px",
          gap: "24px",
          alignItems: "start",
        }}
      >
        {/* LEFT: hero + article grid */}
        <div style={{ minWidth: 0 }}>
          <ActiveTabContent
            tab={tab}
            loading={articlesLoading}
            hero={hero}
            gridArticles={gridArticles}
            hasMore={hasMore}
            onShowMore={() => setGridLimit((n) => n + GRID_LIMIT)}
            holdingsCount={holdingsTickers.length}
            watchlistCount={watchlistTickers.length}
          />
        </div>

        {/* RIGHT: trending sidebar */}
        <aside
          style={{
            position: "sticky",
            top: "88px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            alignSelf: "start",
          }}
        >
          <TrendingStories items={trendingStories} />
          <TrendingTickers items={trendingTickers} />
        </aside>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "12px 18px",
        background: "transparent",
        border: "none",
        // The parent has a 1px bottom border; the active 2px bar visually
        // overlaps it via a -1px shift so the orange sits flush against
        // the muted line.
        borderBottom: active
          ? "2px solid var(--accent)"
          : "2px solid transparent",
        marginBottom: "-1px",
        fontFamily: "inherit",
        fontSize: "14px",
        fontWeight: 600,
        color: active
          ? "var(--text-primary)"
          : hovered
            ? "var(--text-primary)"
            : "var(--text-muted)",
        cursor: active ? "default" : "pointer",
        transition: "color 150ms ease-out",
      }}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Tab content — hero + grid + empty/loading states
// ---------------------------------------------------------------------------

function ActiveTabContent({
  tab,
  loading,
  hero,
  gridArticles,
  hasMore,
  onShowMore,
  holdingsCount,
  watchlistCount,
}: {
  tab: NewsTab;
  loading: boolean;
  hero: Article | null;
  gridArticles: Article[];
  hasMore: boolean;
  onShowMore: () => void;
  holdingsCount: number;
  watchlistCount: number;
}) {
  // Empty list shortcuts before we even render the loading state.
  if (tab === "holdings" && holdingsCount === 0) {
    return (
      <EmptyTabMessage text="Connect a brokerage to see news for your holdings." />
    );
  }
  if (tab === "watchlist" && watchlistCount === 0) {
    return (
      <EmptyTabMessage text="Add tickers to your watchlist on the Markets page to see news here." />
    );
  }

  if (loading) {
    return (
      <div
        style={{
          padding: "80px 0",
          textAlign: "center",
          color: "var(--text-muted)",
          fontSize: "14px",
        }}
      >
        Loading news…
      </div>
    );
  }

  if (!hero) {
    return (
      <EmptyTabMessage text="No articles yet. Check back soon." />
    );
  }

  return (
    <>
      <HeroArticle article={hero} />
      {gridArticles.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "20px",
            marginTop: "20px",
          }}
        >
          {gridArticles.map((a) => (
            <GridArticle key={a.uuid} article={a} />
          ))}
        </div>
      )}
      {hasMore && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: "24px",
          }}
        >
          <button
            type="button"
            onClick={onShowMore}
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              padding: "10px 20px",
              fontSize: "13px",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "color 150ms, border-color 150ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--text-primary)";
              e.currentTarget.style.borderColor = "var(--text-muted)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-muted)";
              e.currentTarget.style.borderColor = "var(--border)";
            }}
          >
            Load more
          </button>
        </div>
      )}
    </>
  );
}

function EmptyTabMessage({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: "80px 0",
        textAlign: "center",
        color: "var(--text-muted)",
        fontSize: "14px",
      }}
    >
      {text}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero & grid article cards
// ---------------------------------------------------------------------------

function HeroArticle({ article }: { article: Article }) {
  return (
    <ArticleLink href={article.link}>
      <Card padding="0" hoverable>
        <ArticleThumbnail
          src={article.thumbnail}
          alt={article.title}
          height={360}
        />
        <div style={{ padding: "24px" }}>
          <TagPill ticker={article.ticker} />
          <h2
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: "var(--text-primary)",
              lineHeight: 1.3,
              margin: 0,
              marginBottom: "12px",
              letterSpacing: "-0.015em",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {article.title}
          </h2>
          {article.summary && (
            <p
              style={{
                fontSize: "14px",
                color: "var(--text-muted)",
                lineHeight: 1.5,
                margin: 0,
                marginBottom: "20px",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {article.summary}
            </p>
          )}
          <ArticleFooter article={article} />
        </div>
      </Card>
    </ArticleLink>
  );
}

function GridArticle({ article }: { article: Article }) {
  return (
    <ArticleLink href={article.link}>
      <Card padding="0" hoverable>
        <ArticleThumbnail
          src={article.thumbnail}
          alt={article.title}
          height={180}
        />
        <div style={{ padding: "18px" }}>
          <TagPill ticker={article.ticker} />
          <h3
            style={{
              fontSize: "16px",
              fontWeight: 600,
              color: "var(--text-primary)",
              lineHeight: 1.4,
              margin: 0,
              marginBottom: "14px",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {article.title}
          </h3>
          <ArticleFooter article={article} small />
        </div>
      </Card>
    </ArticleLink>
  );
}

function ArticleLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "block",
        textDecoration: "none",
        color: "inherit",
        borderRadius: "12px",
      }}
    >
      {children}
    </a>
  );
}

// The thumbnail handles its own broken-image fallback by toggling local state
// down to the gradient placeholder.
function ArticleThumbnail({
  src,
  alt,
  height,
}: {
  src: string | null;
  alt: string;
  height: number;
}) {
  const [errored, setErrored] = useState(false);
  if (!src || errored) {
    return (
      <div
        style={{
          width: "100%",
          height,
          ...fallbackThumbStyle(),
          borderTopLeftRadius: "12px",
          borderTopRightRadius: "12px",
        }}
        aria-hidden="true"
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => setErrored(true)}
      style={{
        width: "100%",
        height,
        objectFit: "cover",
        display: "block",
        borderTopLeftRadius: "12px",
        borderTopRightRadius: "12px",
      }}
    />
  );
}

function TagPill({ ticker }: { ticker: string }) {
  return (
    <div
      className="font-mono uppercase"
      style={{
        fontSize: "10px",
        letterSpacing: "0.2em",
        color: "var(--accent)",
        marginBottom: "12px",
      }}
    >
      {ticker}
    </div>
  );
}

function ArticleFooter({
  article,
  small,
}: {
  article: Article;
  small?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "12px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          minWidth: 0,
        }}
      >
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "10px",
            fontWeight: 700,
            color: "var(--text-primary)",
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          {publisherInitial(article.publisher)}
        </span>
        <span
          style={{
            fontSize: small ? "11px" : "12px",
            color: "var(--text-muted)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {article.publisher || "—"} · {relativeTime(article.timestamp)}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          color: "var(--text-muted)",
          flexShrink: 0,
        }}
      >
        {/* Decorative icon "buttons" — rendered as spans because the parent
            <a> can't contain interactive children. Clicking anywhere on the
            card opens the article (which is what these icons would do
            anyway). */}
        <span aria-hidden="true">
          <Heart size={16} />
        </span>
        <span aria-hidden="true">
          <ExternalLink size={16} />
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Right rail — Trending Stories
// ---------------------------------------------------------------------------

function TrendingStories({ items }: { items: Article[] }) {
  return (
    <Card padding="20px">
      <SidebarHeader title="Trending Stories" />
      {items.length === 0 ? (
        <SidebarLoading />
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            marginTop: "16px",
          }}
        >
          {items.map((item) => (
            <TrendingStoryRow key={item.uuid} article={item} />
          ))}
        </div>
      )}
    </Card>
  );
}

function TrendingStoryRow({ article }: { article: Article }) {
  return (
    <ArticleLink href={article.link}>
      <div
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "flex-start",
        }}
      >
        <TrendingThumb src={article.thumbnail} alt={article.title} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="font-mono uppercase"
            style={{
              fontSize: "9px",
              letterSpacing: "0.2em",
              color: "var(--accent)",
              marginBottom: "4px",
            }}
          >
            {article.ticker}
          </div>
          <div
            style={{
              fontSize: "13px",
              color: "var(--text-primary)",
              lineHeight: 1.35,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {article.title}
          </div>
        </div>
      </div>
    </ArticleLink>
  );
}

function TrendingThumb({
  src,
  alt,
}: {
  src: string | null;
  alt: string;
}) {
  const [errored, setErrored] = useState(false);
  if (!src || errored) {
    return (
      <div
        style={{
          width: 56,
          height: 56,
          flexShrink: 0,
          borderRadius: "8px",
          ...fallbackThumbStyle(),
        }}
        aria-hidden="true"
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={56}
      height={56}
      onError={() => setErrored(true)}
      style={{
        width: 56,
        height: 56,
        flexShrink: 0,
        objectFit: "cover",
        borderRadius: "8px",
        display: "block",
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Right rail — Trending Tickers
// ---------------------------------------------------------------------------

function TrendingTickers({ items }: { items: TrendingTicker[] }) {
  return (
    <Card padding="20px">
      <SidebarHeader title="Trending Tickers" />
      {items.length === 0 ? (
        <SidebarLoading />
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: "8px",
          }}
        >
          {items.map((t, i) => (
            <TrendingTickerRow
              key={t.symbol}
              item={t}
              isLast={i === items.length - 1}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function TrendingTickerRow({
  item,
  isLast,
}: {
  item: TrendingTicker;
  isLast: boolean;
}) {
  const positive = item.changePercent >= 0;
  const color = positive ? "var(--accent-green)" : "var(--accent-red)";
  const bg = positive
    ? "color-mix(in srgb, var(--accent-green) 15%, transparent)"
    : "color-mix(in srgb, var(--accent-red) 15%, transparent)";
  const Icon = positive ? TrendingUp : TrendingDown;
  const sign = positive ? "+" : "";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 0",
        borderBottom: isLast ? "none" : "1px solid var(--border)",
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", gap: "10px" }}
      >
        <Icon size={14} color={color} aria-hidden="true" />
        <span
          className="font-mono"
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--text-primary)",
          }}
        >
          {item.symbol}
        </span>
      </div>
      <span
        className="font-mono tabular-nums"
        style={{
          background: bg,
          color,
          padding: "2px 8px",
          borderRadius: "6px",
          fontSize: "11px",
          fontWeight: 700,
        }}
      >
        {sign}
        {item.changePercent.toFixed(2)}%
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar shared bits
// ---------------------------------------------------------------------------

function SidebarHeader({ title }: { title: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <span
        style={{
          fontSize: "16px",
          fontWeight: 700,
          color: "var(--text-primary)",
        }}
      >
        {title}
      </span>
      <ArrowRight
        size={16}
        color="var(--text-muted)"
        aria-hidden="true"
      />
    </div>
  );
}

function SidebarLoading() {
  return (
    <div
      style={{
        fontSize: "12px",
        color: "var(--text-muted)",
        padding: "16px 0 4px",
      }}
    >
      Loading…
    </div>
  );
}

