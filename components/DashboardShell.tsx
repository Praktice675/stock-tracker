"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import DetailPanel from "@/components/DetailPanel";
import IndicesStrip from "@/components/IndicesStrip";
import PortfolioTracker from "@/components/PortfolioTracker";
import StockChart from "@/components/StockChart";
import Watchlist from "@/components/Watchlist";
import {
  addToWatchlist as dbAddToWatchlist,
  getWatchlist as dbGetWatchlist,
  removeFromWatchlist as dbRemoveFromWatchlist,
} from "@/lib/db/watchlist";
import { createClient } from "@/lib/supabase/client";

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

export default function DashboardShell() {
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>(DEFAULT_WATCHLIST);
  const [selectedTicker, setSelectedTicker] = useState("AAPL");
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("watchlist");
  const hydratedRef = useRef(false);

  // Track current user (initial fetch + auth state subscription).
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      setUser(data.user);
      setAuthLoaded(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      },
    );
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  // Refresh watchlist from DB.
  const refreshWatchlistFromDb = useCallback(async () => {
    try {
      const items = await dbGetWatchlist();
      if (items.length === 0) {
        // Logged in but empty list — keep defaults visible so the dashboard
        // isn't empty on a brand-new account. Defaults are not persisted.
        setWatchlist(DEFAULT_WATCHLIST);
        return;
      }
      const entries = items.map((i) => ({ ticker: i.ticker, name: i.name }));
      setWatchlist(entries);
      if (!entries.some((e) => e.ticker === selectedTicker)) {
        setSelectedTicker(entries[0].ticker);
      }
    } catch (err) {
      console.warn("Failed to load watchlist from DB:", err);
    }
  }, [selectedTicker]);

  // Silent localStorage → DB migration, then load DB watchlist.
  // For logged-out visitors: load from localStorage (or keep defaults).
  useEffect(() => {
    if (!authLoaded) return;

    let cancelled = false;

    async function init() {
      if (user) {
        try {
          // If user already has rows in DB, just load. Otherwise check for
          // any localStorage data left from a logged-out session and import.
          const existing = await dbGetWatchlist();
          if (existing.length > 0) {
            if (cancelled) return;
            const entries = existing.map((i) => ({
              ticker: i.ticker,
              name: i.name,
            }));
            setWatchlist(entries);
            if (!entries.some((e) => e.ticker === selectedTicker)) {
              setSelectedTicker(entries[0].ticker);
            }
            hydratedRef.current = true;
            return;
          }

          // No DB rows yet — try migrating from localStorage if present.
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            try {
              const items = JSON.parse(raw) as unknown;
              if (
                Array.isArray(items) &&
                items.length > 0 &&
                items.every(isValidEntry)
              ) {
                const rows = items.map((item, index) => ({
                  user_id: user!.id,
                  ticker: item.ticker,
                  name: item.name,
                  position: index,
                }));
                await supabase.from("watchlist_items").insert(rows);
                localStorage.removeItem(STORAGE_KEY);
              }
            } catch (err) {
              console.warn("localStorage migration failed:", err);
            }
          }

          if (cancelled) return;
          await refreshWatchlistFromDb();
          hydratedRef.current = true;
        } catch (err) {
          console.warn("Watchlist init (DB) failed:", err);
          hydratedRef.current = true;
        }
        return;
      }

      // Logged-out: fall back to localStorage (legacy visitor path).
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
            if (!parsed.some((s: WatchlistEntry) => s.ticker === selectedTicker)) {
              setSelectedTicker(parsed[0].ticker);
            }
          }
        }
      } catch (err) {
        console.warn("Failed to load watchlist from localStorage:", err);
      }
      hydratedRef.current = true;
    }

    init();
    return () => {
      cancelled = true;
    };
    // selectedTicker intentionally not in deps — only re-run when auth state changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoaded, user, supabase]);

  // Logged-out localStorage persistence (unchanged from pre-DB behavior).
  // Logged-in users persist via DB ops; we skip this to avoid stale writes.
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (user) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
    } catch (err) {
      console.warn("Failed to save watchlist to localStorage:", err);
    }
  }, [watchlist, user]);

  const handleAddToWatchlist = useCallback(
    async (stock: WatchlistEntry) => {
      // Optimistic update for snappy UI in both modes.
      setWatchlist((prev) =>
        prev.some((s) => s.ticker === stock.ticker) ? prev : [stock, ...prev],
      );

      if (user) {
        try {
          await dbAddToWatchlist(stock.ticker, stock.name);
          await refreshWatchlistFromDb();
        } catch (err) {
          console.warn("DB add failed:", err);
          // Roll back optimistic add on failure.
          setWatchlist((prev) => prev.filter((s) => s.ticker !== stock.ticker));
        }
      }
    },
    [user, refreshWatchlistFromDb],
  );

  const handleRemoveFromWatchlist = useCallback(
    async (ticker: string) => {
      // Snapshot for rollback.
      const prevSelected = selectedTicker;
      let removed: WatchlistEntry | undefined;

      setWatchlist((prev) => {
        if (prev.length <= 1) return prev;
        removed = prev.find((s) => s.ticker === ticker);
        const next = prev.filter((s) => s.ticker !== ticker);
        if (selectedTicker === ticker) {
          setSelectedTicker(next[0].ticker);
        }
        return next;
      });

      if (user && removed) {
        try {
          await dbRemoveFromWatchlist(ticker);
          await refreshWatchlistFromDb();
        } catch (err) {
          console.warn("DB remove failed:", err);
          setWatchlist((prev) =>
            prev.some((s) => s.ticker === ticker) ? prev : [removed!, ...prev],
          );
          setSelectedTicker(prevSelected);
        }
      }
    },
    [user, selectedTicker, refreshWatchlistFromDb],
  );

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
                user={user}
                authLoaded={authLoaded}
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
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="font-mono font-bold uppercase transition-opacity hover:opacity-70"
          style={{
            fontSize: "11px",
            letterSpacing: "0.3em",
            color: "rgb(var(--color-black))",
            textDecoration: "none",
          }}
        >
          ← Pulse
        </Link>
        <span
          aria-hidden="true"
          style={{
            width: "1px",
            height: "14px",
            backgroundColor: "rgba(0, 0, 0, 0.25)",
          }}
        />
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
      </div>

      <IndicesStrip />
    </header>
  );
}
