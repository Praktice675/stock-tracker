"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  Search,
  Settings,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import CompanyLogo from "@/components/markets/CompanyLogo";
import Sparkline from "@/components/markets/Sparkline";
import { useSidebarState } from "@/components/SidebarStateContext";
import { createClient } from "@/lib/supabase/client";

type Props = {
  user: User;
  displayName: string;
  avatarUrl: string | null;
};

type Quote = {
  price: number;
  changePercent: number;
};

const NAV_TICKERS = [
  "AAPL",
  "NVDA",
  "TSLA",
  "MSFT",
  "META",
  "AMZN",
  "GOOG",
  "SPY",
];

export default function DashboardNavbar({
  user,
  displayName,
  avatarUrl,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const { collapsed, toggleCollapsed } = useSidebarState();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);

  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [sparks, setSparks] = useState<Record<string, number[]>>({});
  const [profileOpen, setProfileOpen] = useState(false);
  const [avatarErrored, setAvatarErrored] = useState(false);

  // ---- Live-quote polling (mirrors Watchlist's pattern: 30s interval,
  // pauses while tab hidden, batched per tick) ----
  useEffect(() => {
    let cancelled = false;

    const fetchOne = async (ticker: string) => {
      try {
        const res = await fetch(`/api/quote/${ticker}`, { cache: "no-store" });
        if (cancelled || !res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        if (json?.error || typeof json?.price !== "number") return;
        setQuotes((prev) => ({
          ...prev,
          [ticker]: {
            price: json.price,
            changePercent:
              typeof json.changePercent === "number" ? json.changePercent : 0,
          },
        }));
      } catch (err) {
        console.warn(`Navbar quote fetch for ${ticker} failed:`, err);
      }
    };

    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      void Promise.all(NAV_TICKERS.map(fetchOne));
    };

    tick();
    let id = setInterval(tick, 30_000);

    const onVisibility = () => {
      if (document.hidden) {
        clearInterval(id);
      } else {
        tick();
        id = setInterval(tick, 30_000);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // ---- Sparkline fetch (once per ticker, no polling) ----
  useEffect(() => {
    let cancelled = false;
    NAV_TICKERS.forEach(async (ticker) => {
      try {
        const res = await fetch(`/api/candles/${ticker}?timeframe=1M`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!Array.isArray(data) || cancelled) return;
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
        console.warn(`Navbar sparkline fetch for ${ticker} failed:`, err);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Cmd+K / Ctrl+K → focus search ----
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const modifier = isMac ? e.metaKey : e.ctrlKey;
      if (modifier && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ---- Profile dropdown click-outside + Escape ----
  // Listen on `click`, NOT `mousedown`. With mousedown the close handler ran
  // before the Link's click event could reach Next.js's navigation handler;
  // any race in the same tick could swallow the navigation. `click` fires
  // after all inner click handlers (including <Link>'s router.push) finish.
  useEffect(() => {
    if (!profileOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      const node = profileRef.current;
      if (node && !node.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setProfileOpen(false);
    };
    document.addEventListener("click", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [profileOpen]);

  // Close the dropdown whenever the route changes — covers the "click Settings"
  // path without putting setState on the Link's own onClick (which would race
  // with Link's navigation in the same React tick).
  useEffect(() => {
    setProfileOpen(false);
  }, [pathname]);

  function handleSearchKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const value = e.currentTarget.value.trim().toUpperCase();
      if (value) {
        router.push(`/dashboard?ticker=${encodeURIComponent(value)}`);
        e.currentTarget.value = "";
        e.currentTarget.blur();
      }
    } else if (e.key === "Escape") {
      e.currentTarget.blur();
    }
  }

  async function handleSignOut() {
    setProfileOpen(false);
    await supabase.auth.signOut();
    router.refresh();
  }

  const email = user.email ?? "";
  const initial = (
    displayName.charAt(0) || email.charAt(0) || "?"
  ).toUpperCase();
  const showAvatar = !!avatarUrl && !avatarErrored;

  return (
    <div
      role="banner"
      className="pulse-navbar"
      style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: "16px",
        padding: "0 24px 0 0",
        height: "64px",
        borderBottom: "1px solid var(--border)",
        background: "transparent",
        // NOTE: NO overflow:hidden here. The ticker-pills child manages its
        // own horizontal scroll (overflowX:auto) and the brand cluster has
        // its own overflow:hidden for the wordmark squeeze. A wrapper-level
        // overflow:hidden previously clipped the profile dropdown's pop-out
        // — the dropdown rendered into the DOM but was invisible.
      }}
    >
      {/* Brand cluster — anchors the top-left of the page above the sidebar
          column. Width tracks the sidebar so the column edge lines up cleanly
          (240 expanded → 72 collapsed, same 200ms ease-out transition). */}
      <Link
        href="/dashboard"
        aria-label="Pulse home"
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: collapsed ? "72px" : "240px",
          paddingLeft: "18px",
          paddingRight: "8px",
          gap: "12px",
          height: "100%",
          textDecoration: "none",
          color: "var(--accent)",
          overflow: "hidden",
          transition: "width 200ms ease-out",
        }}
      >
        {collapsed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/logos/pulse-mark.svg"
            alt="Pulse"
            width={32}
            height={32}
            style={{
              display: "block",
              width: 32,
              height: 32,
              flexShrink: 0,
            }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/logos/pulse-lockup.svg"
            alt="Pulse"
            height={36}
            style={{
              display: "block",
              height: 36,
              width: "auto",
              flexShrink: 0,
            }}
          />
        )}
        <CollapseToggle
          collapsed={collapsed}
          onClick={(e) => {
            // Prevent the parent Link's navigation when the user clicks the
            // toggle. We still want the wordmark itself to link to /dashboard.
            e.preventDefault();
            e.stopPropagation();
            toggleCollapsed();
          }}
        />
      </Link>

      {/* Ticker tape — continuously scrolling pills, pauses on hover.
          The list is rendered twice so the keyframes can loop seamlessly
          by translating the inner track by -50%. Live-price polling and
          click-to-select still work — animation is purely visual. */}
      <div className="ticker-tape">
        <div className="ticker-tape-inner">
          {NAV_TICKERS.map((ticker) => (
            <TickerPill
              key={ticker}
              ticker={ticker}
              quote={quotes[ticker]}
              spark={sparks[ticker]}
              onClick={() =>
                router.push(`/dashboard?ticker=${encodeURIComponent(ticker)}`)
              }
            />
          ))}
          {NAV_TICKERS.map((ticker) => (
            <TickerPill
              key={`dup-${ticker}`}
              ticker={ticker}
              quote={quotes[ticker]}
              spark={sparks[ticker]}
              ariaHidden
              onClick={() =>
                router.push(`/dashboard?ticker=${encodeURIComponent(ticker)}`)
              }
            />
          ))}
        </div>
      </div>

      {/* Utility cluster */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          flexShrink: 0,
        }}
      >
        {/* Search */}
        <div
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "10px",
            padding: "8px 12px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            minWidth: "280px",
          }}
        >
          <Search size={14} color="var(--text-muted)" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search ticker..."
            onKeyDown={handleSearchKey}
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text-primary)",
              fontSize: "13px",
              fontFamily: "inherit",
              flex: 1,
              minWidth: 0,
            }}
          />
          <span
            className="font-mono"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              padding: "2px 6px",
              fontSize: "10px",
              color: "var(--text-muted)",
              flexShrink: 0,
            }}
          >
            ⌘K
          </span>
        </div>

        {/* Bell */}
        <button
          type="button"
          onClick={() => console.log("notifications coming soon")}
          aria-label="Notifications"
          title="Notifications"
          style={{
            width: 36,
            height: 36,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "10px",
            color: "var(--text-muted)",
            cursor: "pointer",
            padding: 0,
            transition: "color 150ms ease-out, border-color 150ms ease-out",
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
          <Bell size={16} aria-hidden="true" />
        </button>

        {/* Profile pill */}
        <div
          ref={profileRef}
          style={{ position: "relative" }}
        >
          <button
            type="button"
            onClick={() => setProfileOpen((p) => !p)}
            aria-haspopup="menu"
            aria-expanded={profileOpen}
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "999px",
              padding: "4px 10px 4px 4px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
              color: "var(--text-primary)",
              fontSize: "12px",
              fontFamily: "inherit",
            }}
          >
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "var(--bg-surface)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              {showAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl as string}
                  alt={displayName}
                  width={28}
                  height={28}
                  onError={() => setAvatarErrored(true)}
                  style={{ width: 28, height: 28, objectFit: "cover" }}
                />
              ) : (
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 12,
                    color: "var(--text-primary)",
                  }}
                >
                  {initial}
                </span>
              )}
            </span>
            <span>{displayName}</span>
            <ChevronDown
              size={14}
              color="var(--text-muted)"
              aria-hidden="true"
            />
          </button>

          {profileOpen && (
            <div
              role="menu"
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                minWidth: "200px",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "10px",
                padding: "6px",
                zIndex: 50,
                boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              }}
            >
              {/* NOTE: no onClick here. The dropdown closes via the
                  usePathname effect once Next.js commits the route. Putting
                  setState on this Link's own onClick used to swallow the
                  navigation in the same React tick — the dropdown's
                  conditional render would unmount the Link before Next.js's
                  internal click handler could call router.push(). */}
              <Link
                href="/dashboard/settings"
                role="menuitem"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  color: "var(--text-primary)",
                  textDecoration: "none",
                  transition: "background-color 100ms ease-out",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--bg-surface)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <Settings
                  size={14}
                  color="var(--text-muted)"
                  aria-hidden="true"
                />
                Settings
              </Link>
              <div
                role="separator"
                aria-hidden="true"
                style={{
                  height: "1px",
                  background: "var(--border)",
                  margin: "4px 0",
                }}
              />
              <button
                type="button"
                role="menuitem"
                onClick={handleSignOut}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  color: "var(--accent-red)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "background-color 100ms ease-out",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--bg-surface)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <LogOut
                  size={14}
                  color="var(--accent-red)"
                  aria-hidden="true"
                />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TickerPill({
  ticker,
  quote,
  spark,
  onClick,
  ariaHidden,
}: {
  ticker: string;
  quote: Quote | undefined;
  spark: number[] | undefined;
  onClick: () => void;
  ariaHidden?: boolean;
}) {
  const has = !!quote;
  const positive = has ? quote.changePercent >= 0 : true;
  const pct = has ? quote.changePercent : 0;
  const sign = positive ? "+" : "";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-hidden={ariaHidden}
      tabIndex={ariaHidden ? -1 : undefined}
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "999px",
        padding: "6px 12px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        cursor: "pointer",
        flexShrink: 0,
        transition: "border-color 150ms ease-out",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--text-muted)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
      }}
    >
      <CompanyLogo ticker={ticker} size={18} />
      <span
        className="font-mono"
        style={{
          fontSize: "11px",
          fontWeight: 700,
          color: "var(--text-primary)",
          letterSpacing: "0.05em",
        }}
      >
        {ticker}
      </span>
      <Sparkline
        data={spark ?? []}
        positive={positive}
        width={40}
        height={16}
      />
      <span
        className="font-mono tabular-nums"
        style={{
          background: has
            ? positive
              ? "color-mix(in srgb, var(--accent-green) 15%, transparent)"
              : "color-mix(in srgb, var(--accent-red) 15%, transparent)"
            : "var(--bg-surface)",
          color: has
            ? positive
              ? "var(--accent-green)"
              : "var(--accent-red)"
            : "var(--text-muted)",
          fontSize: "10px",
          fontWeight: 700,
          padding: "2px 6px",
          borderRadius: "4px",
        }}
      >
        {has ? `${sign}${pct.toFixed(2)}%` : "—"}
      </span>
    </button>
  );
}

function CollapseToggle({
  collapsed,
  onClick,
}: {
  collapsed: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      style={{
        width: 32,
        height: 32,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        color: "var(--text-muted)",
        cursor: "pointer",
        padding: 0,
        flexShrink: 0,
        transition: "color 150ms ease-out, border-color 150ms ease-out",
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
      {collapsed ? (
        <ChevronsRight size={16} aria-hidden="true" />
      ) : (
        <ChevronsLeft size={16} aria-hidden="true" />
      )}
    </button>
  );
}
