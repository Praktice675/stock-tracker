"use client";

import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import CompanyLogo from "@/components/markets/CompanyLogo";
import Sparkline from "@/components/markets/Sparkline";

type WatchlistEntry = { ticker: string; name: string };

type LiveQuote = {
  price: number;
  change: number;
  changePercent: number;
};

type SearchResult = { ticker: string; name: string };

const POSITIVE = "#00FF94";
const NEGATIVE = "#FF3B5C";

type WatchlistProps = {
  selectedTicker: string;
  onSelect: (ticker: string) => void;
  watchlist: WatchlistEntry[];
  onAddToWatchlist: (stock: WatchlistEntry) => void;
  onRemoveFromWatchlist: (ticker: string) => void;
};

type FlashDirection = "green" | "red";

export default function Watchlist({
  selectedTicker,
  onSelect,
  watchlist,
  onAddToWatchlist,
  onRemoveFromWatchlist,
}: WatchlistProps) {
  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>({});
  // Per-ticker close-price series for the inline sparkline. Populated once
  // per ticker via /api/candles?timeframe=1M; we don't poll for updates.
  const [sparks, setSparks] = useState<Record<string, number[]>>({});
  const [flashStates, setFlashStates] = useState<
    Record<string, FlashDirection | null>
  >({});
  const prevPrices = useRef<Record<string, number>>({});
  const flashTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );
  const sparkFetchedRef = useRef<Set<string>>(new Set());

  // Search state
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [flashTicker, setFlashTicker] = useState<string | null>(null);

  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const watchlistRef = useRef(watchlist);
  watchlistRef.current = watchlist;
  const cancelledRef = useRef(false);

  const triggerFlash = (ticker: string, direction: FlashDirection) => {
    const pending = flashTimeoutsRef.current[ticker];
    if (pending) clearTimeout(pending);
    setFlashStates((s) => ({ ...s, [ticker]: direction }));
    flashTimeoutsRef.current[ticker] = setTimeout(() => {
      setFlashStates((s) => ({ ...s, [ticker]: null }));
      delete flashTimeoutsRef.current[ticker];
    }, 700);
  };

  // ---- Live-quote polling: every 30s, Promise.all across visible tickers.
  // Now that /api/quote has a 30s module-level cache, all clients hammering
  // the same ticker collapse to one Yahoo call per 30s, so parallel is safe.
  // Pauses while the tab is hidden (no point burning quote calls for a
  // tab the user isn't looking at).
  const fetchOneQuote = async (ticker: string) => {
    try {
      const res = await fetch(`/api/quote/${ticker}`, { cache: "no-store" });
      if (cancelledRef.current || !res.ok) return;
      const json = await res.json();
      if (cancelledRef.current) return;
      if (json?.error || typeof json?.price !== "number") return;

      const newPrice = json.price as number;
      const prev = prevPrices.current[ticker];
      // Skip the initial value so we don't flash everything on first load
      if (prev !== undefined && newPrice !== prev) {
        triggerFlash(ticker, newPrice > prev ? "green" : "red");
      }
      prevPrices.current[ticker] = newPrice;

      setQuotes((prev) => ({
        ...prev,
        [ticker]: {
          price: newPrice,
          change: json.change,
          changePercent: json.changePercent,
        },
      }));
    } catch (err) {
      console.warn(`Quote fetch for ${ticker} failed:`, err);
    }
  };

  // Clear any pending flash timeouts on unmount
  useEffect(() => {
    return () => {
      for (const id of Object.values(flashTimeoutsRef.current)) {
        clearTimeout(id);
      }
      flashTimeoutsRef.current = {};
    };
  }, []);

  useEffect(() => {
    cancelledRef.current = false;

    const pollAll = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      const list = watchlistRef.current;
      void Promise.all(list.map((stock) => fetchOneQuote(stock.ticker)));
    };

    pollAll();
    let id = setInterval(pollAll, 30_000);

    const onVisibility = () => {
      if (document.hidden) {
        clearInterval(id);
      } else {
        // Tab regained focus — fetch immediately so the user sees fresh
        // numbers instead of waiting up to 30s, then resume the interval.
        pollAll();
        id = setInterval(pollAll, 30_000);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelledRef.current = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When a new ticker is added via search, immediately fetch its quote
  // so the new row doesn't sit on "---" until the next poll tick.
  const fetchedTickersRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const s of watchlist) {
      if (!fetchedTickersRef.current.has(s.ticker)) {
        fetchedTickersRef.current.add(s.ticker);
        fetchOneQuote(s.ticker);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlist]);

  // Fetch a ~1-month close series for each visible ticker once per session.
  // 1M from /api/candles returns ~22 daily candles — enough for a clean
  // sparkline. NO `cancelled` flag: this effect re-runs whenever `watchlist`
  // changes (the DB-load flow in DashboardShell updates the list shortly
  // after first render), and a cancellation closure would gate the in-flight
  // fetches from the first run, while the dedupe ref would block them from
  // re-firing — leaving the originally-visible tickers permanently empty.
  // setSparks after unmount is a no-op in React 18, so unconditional setState
  // is safe.
  useEffect(() => {
    async function fetchOneSparkline(ticker: string) {
      try {
        const res = await fetch(`/api/candles/${ticker}?timeframe=1M`);
        if (!res.ok) return;
        const data = await res.json();
        if (!Array.isArray(data)) return;
        const closes: number[] = [];
        for (const c of data) {
          if (typeof c?.close === "number" && Number.isFinite(c.close)) {
            closes.push(c.close);
          }
        }
        if (closes.length > 0) {
          setSparks((prev) => ({ ...prev, [ticker]: closes }));
        }
      } catch (err) {
        console.warn(`Sparkline fetch for ${ticker} failed:`, err);
      }
    }

    for (const s of watchlist) {
      if (!sparkFetchedRef.current.has(s.ticker)) {
        sparkFetchedRef.current.add(s.ticker);
        void fetchOneSparkline(s.ticker);
      }
    }
  }, [watchlist]);

  // ---- Debounced search ----
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    let cancelled = false;
    fetch(`/api/search?q=${encodeURIComponent(q)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (cancelled) return;
        setResults(Array.isArray(data) ? data : []);
        setSearching(false);
      })
      .catch((err) => {
        console.warn("Search fetch failed:", err);
        if (!cancelled) {
          setResults([]);
          setSearching(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [results]);

  // Outside-click dismissal
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const node = searchContainerRef.current;
      if (node && !node.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // "Already in watchlist" flash: clear after 1s and close the dropdown
  useEffect(() => {
    if (!flashTicker) return;
    const id = setTimeout(() => {
      setFlashTicker(null);
      setDropdownOpen(false);
    }, 1000);
    return () => clearTimeout(id);
  }, [flashTicker]);

  const watchlistTickers = useMemo(
    () => new Set(watchlist.map((s) => s.ticker)),
    [watchlist],
  );

  const closeSearch = () => {
    setQuery("");
    setDebouncedQuery("");
    setResults([]);
    setDropdownOpen(false);
    inputRef.current?.blur();
  };

  const viewOnly = (ticker: string) => {
    onSelect(ticker);
    closeSearch();
  };

  const addAndView = (stock: SearchResult) => {
    onAddToWatchlist(stock);
    onSelect(stock.ticker);
    closeSearch();
  };

  const handlePrimary = (stock: SearchResult) => {
    if (watchlistTickers.has(stock.ticker)) {
      onSelect(stock.ticker);
      setFlashTicker(stock.ticker);
    } else {
      addAndView(stock);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setDropdownOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!dropdownOpen || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = results[highlightedIndex];
      if (r) handlePrimary(r);
    }
  };

  const showDropdown = dropdownOpen && query.trim().length > 0;
  const canRemove = watchlist.length > 1;

  return (
    <div className="flex h-full flex-col">
      <div
        ref={searchContainerRef}
        style={{ margin: "12px", position: "relative" }}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder="Search ticker..."
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.trim().length > 0) setDropdownOpen(true);
            else setDropdownOpen(false);
          }}
          onFocus={() => {
            if (query.trim().length > 0) setDropdownOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="outline-none placeholder:text-text-muted"
          style={{
            display: "block",
            width: "100%",
            height: "36px",
            padding: "0 12px",
            backgroundColor: "rgb(var(--color-grey-800))",
            borderRadius: "var(--border-radius)",
            border: "none",
            fontFamily: "var(--font-mono), monospace",
            fontSize: "12px",
            letterSpacing: "-0.015em",
            color: "var(--text-primary)",
          }}
        />

        {showDropdown && (
          <div
            role="listbox"
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              zIndex: 50,
              backgroundColor: "rgb(var(--color-grey-800))",
              border: "1px solid var(--border)",
              borderRadius: "var(--border-radius)",
              overflow: "hidden",
            }}
          >
            {query.trim().length < 2 ? (
              <DropdownMessage>Type at least 2 characters…</DropdownMessage>
            ) : searching ? (
              <DropdownMessage>Searching…</DropdownMessage>
            ) : results.length === 0 ? (
              <DropdownMessage>No matches</DropdownMessage>
            ) : (
              results.map((r, i) => (
                <SearchResultRow
                  key={r.ticker}
                  ticker={r.ticker}
                  name={r.name}
                  query={debouncedQuery}
                  highlighted={i === highlightedIndex}
                  inWatchlist={watchlistTickers.has(r.ticker)}
                  flashing={flashTicker === r.ticker}
                  onPrimary={() => handlePrimary(r)}
                  onViewOnly={() => viewOnly(r.ticker)}
                  onHover={() => setHighlightedIndex(i)}
                />
              ))
            )}
          </div>
        )}
      </div>

      <div
        className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        {watchlist.map((stock) => (
          <StockCard
            key={stock.ticker}
            stock={stock}
            quote={quotes[stock.ticker]}
            sparkData={sparks[stock.ticker]}
            selected={stock.ticker === selectedTicker}
            canRemove={canRemove}
            flashDirection={flashStates[stock.ticker] ?? null}
            onSelect={() => onSelect(stock.ticker)}
            onRemove={() => onRemoveFromWatchlist(stock.ticker)}
          />
        ))}
      </div>
    </div>
  );
}

function DropdownMessage({ children }: { children: ReactNode }) {
  return (
    <div
      className="text-text-muted"
      style={{
        padding: "10px 12px",
        fontSize: "11px",
        letterSpacing: "-0.015em",
        fontStyle: "italic",
      }}
    >
      {children}
    </div>
  );
}

function renderTickerWithHighlight(ticker: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return ticker;
  const idx = ticker.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return ticker;
  const before = ticker.slice(0, idx);
  const match = ticker.slice(idx, idx + q.length);
  const after = ticker.slice(idx + q.length);
  return (
    <>
      {before}
      <span
        style={{
          backgroundColor: "rgba(255, 89, 73, 0.22)",
          borderRadius: "2px",
          padding: "0 1px",
        }}
      >
        {match}
      </span>
      {after}
    </>
  );
}

function SearchResultRow({
  ticker,
  name,
  query,
  highlighted,
  inWatchlist,
  flashing,
  onPrimary,
  onViewOnly,
  onHover,
}: {
  ticker: string;
  name: string;
  query: string;
  highlighted: boolean;
  inWatchlist: boolean;
  flashing: boolean;
  onPrimary: () => void;
  onViewOnly: () => void;
  onHover: () => void;
}) {
  // Show buttons when this row is highlighted (mouse hover OR keyboard
  // navigation) AND the ticker isn't already in the watchlist. Keyboard
  // Enter on this row triggers onPrimary regardless.
  const showButtons = highlighted && !inWatchlist && !flashing;

  return (
    <div
      role="option"
      aria-selected={highlighted}
      onMouseDown={(e) => {
        // mousedown wins over the document-level outside-click handler
        e.preventDefault();
        onPrimary();
      }}
      onMouseEnter={onHover}
      style={{
        padding: "10px 12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        cursor: "pointer",
        transition: "background-color 100ms var(--ease)",
        backgroundColor: highlighted
          ? "rgb(var(--color-grey-700))"
          : "transparent",
      }}
    >
      <span
        className="font-mono font-bold"
        style={{
          fontSize: "12px",
          color: "rgb(var(--color-orange))",
          letterSpacing: "-0.015em",
          flexShrink: 0,
        }}
      >
        {renderTickerWithHighlight(ticker, query)}
      </span>

      {flashing ? (
        <span
          className="font-mono"
          style={{
            fontSize: "10px",
            color: "rgb(var(--color-orange))",
            letterSpacing: "-0.015em",
            textAlign: "right",
          }}
        >
          Already in watchlist
        </span>
      ) : showButtons ? (
        <div className="flex items-center" style={{ gap: "6px" }}>
          <PillButton
            variant="primary"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPrimary();
            }}
          >
            Add + View
          </PillButton>
          <PillButton
            variant="muted"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onViewOnly();
            }}
          >
            View only
          </PillButton>
        </div>
      ) : (
        <span
          className="text-text-muted"
          style={{
            fontSize: "11px",
            letterSpacing: "-0.015em",
            textAlign: "right",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {inWatchlist ? `${name} · In list` : name}
        </span>
      )}
    </div>
  );
}

function PillButton({
  variant,
  children,
  onClick,
}: {
  variant: "primary" | "muted";
  children: ReactNode;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const isPrimary = variant === "primary";
  return (
    <button
      type="button"
      onMouseDown={onClick}
      className="font-mono"
      style={{
        fontSize: "10px",
        padding: "3px 8px",
        borderRadius: "var(--border-radius)",
        border: "none",
        cursor: "pointer",
        letterSpacing: "-0.015em",
        backgroundColor: isPrimary
          ? "rgb(var(--color-orange))"
          : "rgb(var(--color-grey-700))",
        color: isPrimary
          ? "rgb(var(--color-black))"
          : "var(--text-muted)",
        fontWeight: isPrimary ? 600 : 500,
      }}
    >
      {children}
    </button>
  );
}

function StockCard({
  stock,
  quote,
  sparkData,
  selected,
  canRemove,
  flashDirection,
  onSelect,
  onRemove,
}: {
  stock: WatchlistEntry;
  quote: LiveQuote | undefined;
  sparkData: number[] | undefined;
  selected: boolean;
  canRemove: boolean;
  flashDirection: FlashDirection | null;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const hasLive = !!quote;
  const showPlaceholder = !hasLive;

  const changePercent = hasLive ? quote.changePercent : 0;
  const isPositive = changePercent >= 0;
  const color = isPositive ? POSITIVE : NEGATIVE;
  const sign = isPositive ? "+" : "";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`group relative cursor-pointer transition-colors duration-150 ease-brand ${
        selected ? "" : "hover:bg-[rgb(var(--color-grey-800))]"
      }`}
      style={{
        padding: "12px",
        // 2px colored gain/loss accent at the bottom (neutral when quote
        // hasn't loaded yet so first paint isn't misleadingly green).
        borderBottom: showPlaceholder
          ? "2px solid var(--border)"
          : `2px solid ${color}`,
        borderLeft: selected
          ? "2px solid rgb(var(--color-orange))"
          : "2px solid transparent",
        backgroundColor: selected ? "rgb(var(--color-grey-700))" : undefined,
      }}
    >
      {canRemove && (
        <button
          type="button"
          aria-label={`Remove ${stock.ticker} from watchlist`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className="opacity-0 transition-opacity duration-150 ease-brand group-hover:opacity-100"
          style={{
            position: "absolute",
            top: "8px",
            right: "8px",
            width: "16px",
            height: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            background: "transparent",
            color: "var(--text-muted)",
            fontSize: "14px",
            lineHeight: 1,
            cursor: "pointer",
            padding: 0,
          }}
        >
          ×
        </button>
      )}

      <div className="flex items-center" style={{ gap: "8px" }}>
        <CompanyLogo ticker={stock.ticker} size={24} />

        <div
          className="flex flex-col"
          style={{ flex: 1, minWidth: 0, gap: "2px" }}
        >
          <span
            className="font-mono font-bold uppercase text-text-primary"
            style={{ fontSize: "13px", letterSpacing: "-0.015em" }}
          >
            {stock.ticker}
          </span>
          <span
            className="text-text-muted"
            style={{
              fontSize: "10px",
              letterSpacing: "-0.015em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {stock.name}
          </span>
        </div>

        {/* Fixed-width slot so the row doesn't reflow when the sparkline loads */}
        <div
          style={{
            width: 64,
            height: 24,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
          }}
        >
          <Sparkline
            data={sparkData ?? []}
            positive={isPositive}
            width={64}
          />
        </div>

        <div
          className="flex flex-col items-end"
          style={{ gap: "2px", flexShrink: 0 }}
        >
          <span
            className={`font-mono text-text-primary ${
              flashDirection === "green"
                ? "flash-green"
                : flashDirection === "red"
                  ? "flash-red"
                  : ""
            }`}
            style={{
              fontSize: "13px",
              letterSpacing: "-0.015em",
              padding: "0 2px",
              display: "inline-block",
            }}
          >
            {showPlaceholder ? "---" : quote!.price.toFixed(2)}
          </span>
          <span
            className={`font-mono font-medium ${
              flashDirection ? "flash-badge" : ""
            }`}
            style={{
              fontSize: "10px",
              padding: "2px 6px",
              borderRadius: "var(--border-radius)",
              backgroundColor: showPlaceholder
                ? "rgb(var(--color-grey-800))"
                : `${color}26`,
              color: showPlaceholder ? "var(--text-muted)" : color,
              letterSpacing: "-0.015em",
            }}
          >
            {showPlaceholder ? "---" : `${sign}${changePercent.toFixed(2)}%`}
          </span>
        </div>
      </div>
    </div>
  );
}
