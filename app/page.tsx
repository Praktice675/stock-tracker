"use client";

import { useEffect, useRef, useState } from "react";
import DetailPanel from "@/components/DetailPanel";
import IndicesStrip from "@/components/IndicesStrip";
import PortfolioTracker from "@/components/PortfolioTracker";
import StockChart from "@/components/StockChart";
import Watchlist from "@/components/Watchlist";

type SidebarTab = "watchlist" | "portfolio";

type WatchlistEntry = { ticker: string; name: string };

const DEFAULT_WATCHLIST: WatchlistEntry[] = [
  { ticker: "AAPL", name: "Apple Inc." },
  { ticker: "NVDA", name: "NVIDIA Corp." },
  { ticker: "TSLA", name: "Tesla Inc." },
  { ticker: "MSFT", name: "Microsoft Corp." },
  { ticker: "SPY", name: "S&P 500 ETF" },
  { ticker: "META", name: "Meta Platforms" },
];

const STORAGE_KEY = "watchlist";

function isValidEntry(v: unknown): v is WatchlistEntry {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { ticker?: unknown }).ticker === "string" &&
    typeof (v as { name?: unknown }).name === "string"
  );
}

export default function Home() {
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>(DEFAULT_WATCHLIST);
  const [selectedTicker, setSelectedTicker] = useState("AAPL");
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("watchlist");
  const hydratedRef = useRef(false);

  // Load from localStorage once on mount. If the loaded list doesn't
  // contain our default selectedTicker ("AAPL"), switch to its first entry.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          Array.isArray(parsed) &&
          parsed.length > 0 &&
          parsed.every(isValidEntry)
        ) {
          setWatchlist(parsed);
          if (!parsed.some((s) => s.ticker === "AAPL")) {
            setSelectedTicker(parsed[0].ticker);
          }
        }
      }
    } catch (err) {
      console.warn("Failed to load watchlist from localStorage:", err);
    }
    hydratedRef.current = true;
  }, []);

  // Persist on every change, but only after hydration so we don't
  // immediately overwrite saved state with the default array.
  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
    } catch (err) {
      console.warn("Failed to save watchlist to localStorage:", err);
    }
  }, [watchlist]);

  const handleAddToWatchlist = (stock: WatchlistEntry) => {
    setWatchlist((prev) =>
      prev.some((s) => s.ticker === stock.ticker) ? prev : [stock, ...prev],
    );
  };

  const handleRemoveFromWatchlist = (ticker: string) => {
    setWatchlist((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((s) => s.ticker !== ticker);
      if (selectedTicker === ticker) {
        setSelectedTicker(next[0].ticker);
      }
      return next;
    });
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-bg-primary text-text-primary">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <aside
          className="flex h-full w-[260px] shrink-0 flex-col bg-bg-surface"
          style={{ borderRight: "1px solid var(--border)" }}
          aria-label="Sidebar"
        >
          <SidebarTabs active={sidebarTab} onChange={setSidebarTab} />
          <div className="flex min-h-0 flex-1 flex-col">
            {sidebarTab === "watchlist" ? (
              <Watchlist
                selectedTicker={selectedTicker}
                onSelect={setSelectedTicker}
                watchlist={watchlist}
                onAddToWatchlist={handleAddToWatchlist}
                onRemoveFromWatchlist={handleRemoveFromWatchlist}
              />
            ) : (
              <PortfolioTracker
                selectedTicker={selectedTicker}
                onSelect={setSelectedTicker}
              />
            )}
          </div>
        </aside>

        <main
          className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-bg-primary"
          style={{ height: "100%" }}
        >
          <StockChart selectedTicker={selectedTicker} />
        </main>

        <aside
          className="flex h-full w-[320px] shrink-0 flex-col overflow-y-auto bg-bg-surface [&::-webkit-scrollbar]:hidden"
          style={{
            borderLeft: "1px solid var(--border)",
            scrollbarWidth: "none",
          }}
          aria-label="Detail panel"
        >
          <DetailPanel selectedTicker={selectedTicker} />
        </aside>
      </div>
    </div>
  );
}

function SidebarTabs({
  active,
  onChange,
}: {
  active: SidebarTab;
  onChange: (t: SidebarTab) => void;
}) {
  return (
    <div
      className="flex shrink-0"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <TabButton
        active={active === "watchlist"}
        onClick={() => onChange("watchlist")}
      >
        Watchlist
      </TabButton>
      <TabButton
        active={active === "portfolio"}
        onClick={() => onChange("portfolio")}
      >
        Portfolio
      </TabButton>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center font-mono uppercase transition-colors duration-150 ease-brand ${
        active ? "" : "text-text-muted hover:text-text-primary"
      }`}
      style={{
        flex: "1 1 50%",
        height: "36px",
        marginBottom: "-1px", // overlap the strip's 1px border with our 2px band
        background: "transparent",
        border: "none",
        borderBottom: active
          ? "2px solid rgb(var(--color-orange))"
          : "2px solid transparent",
        fontSize: "10px",
        letterSpacing: "0.15em",
        color: active ? "var(--text-primary)" : undefined,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function Header() {
  return (
    <header
      className="flex h-[65px] w-full shrink-0 items-center justify-between px-6"
      style={{
        backgroundColor: "rgb(var(--color-orange))",
        borderBottom: "1px solid var(--border)",
        color: "rgb(var(--color-black))",
      }}
    >
      <div className="flex items-center gap-3">
        <span
          className="live-dot inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: "rgb(var(--color-black))" }}
          aria-hidden="true"
        />
        <span
          className="text-sm font-semibold uppercase"
          style={{
            letterSpacing: "0.25em",
            color: "rgb(var(--color-black))",
          }}
        >
          Market
        </span>
      </div>

      <IndicesStrip />
    </header>
  );
}
