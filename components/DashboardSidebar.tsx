"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  Newspaper,
  PieChart,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { useChatContext } from "@/components/chat/ChatProvider";
import { useSidebarState } from "@/components/SidebarStateContext";
import { createClient } from "@/lib/supabase/client";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

const NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Portfolio", href: "/dashboard/portfolio", icon: PieChart },
  { label: "News", href: "/dashboard/news", icon: Newspaper },
];

// US Eastern market hours: Mon-Fri, 9:30am-4:00pm ET. We don't account for
// holidays; the pill is a UX hint, not a tradeable signal.
function getMarketStatus(now: Date): {
  open: boolean;
  hint: string;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = parseInt(
    parts.find((p) => p.type === "hour")?.value ?? "0",
    10,
  );
  const minute = parseInt(
    parts.find((p) => p.type === "minute")?.value ?? "0",
    10,
  );
  const isWeekday = ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(weekday);
  const minutes = hour * 60 + minute;
  const open = isWeekday && minutes >= 9 * 60 + 30 && minutes < 16 * 60;
  return { open, hint: open ? "Closes 4:00 PM" : "Opens 9:30 AM" };
}

type DashboardSidebarProps = {
  displayName?: string;
  avatarUrl?: string | null;
};

export default function DashboardSidebar({
  displayName: displayNameProp,
  avatarUrl: avatarUrlProp,
}: DashboardSidebarProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const chat = useChatContext();
  const { collapsed } = useSidebarState();
  const [user, setUser] = useState<User | null>(null);
  const [market, setMarket] = useState<{ open: boolean; hint: string } | null>(
    null,
  );
  const [avatarErrored, setAvatarErrored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setUser(data.user);
    });
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => setUser(session?.user ?? null),
    );
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  // Recompute market status every 30s — cheap, no network. Pauses while hidden.
  useEffect(() => {
    const tick = () => setMarket(getMarketStatus(new Date()));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.refresh();
  }

  const email = user?.email ?? null;
  const avatarUrl = avatarUrlProp ?? null;

  // displayName comes from the server-resolved user profile (passed through
  // DashboardChrome). The email-prefix fallback below only kicks in if no
  // prop was passed (defensive — pages render the sidebar via DashboardChrome
  // which always supplies the prop).
  const displayName = (() => {
    if (displayNameProp) return displayNameProp;
    if (!email) return "User";
    const prefix = email.split("@")[0];
    if (!prefix) return "User";
    return prefix.charAt(0).toUpperCase() + prefix.slice(1).toLowerCase();
  })();

  const initial = (
    displayName.charAt(0) || email?.charAt(0) || "?"
  ).toUpperCase();
  const showAvatar = !!avatarUrl && !avatarErrored;

  return (
    <aside
      className="dashboard-sidebar"
      data-collapsed={collapsed ? "true" : "false"}
    >
      {/* Brand + collapse toggle now live in DashboardNavbar, top-left of the
          page above the sidebar. The sidebar starts directly with the status
          pill / nav so its vertical position is anchored to the chrome row. */}

      {/* Status pill — only shown when expanded */}
      {!collapsed && (
        <div
          style={{
            margin: "0 18px 20px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "10px",
            padding: "8px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              className="status-dot"
              style={{
                background: market?.open
                  ? "var(--accent-green)"
                  : "var(--text-muted)",
              }}
              aria-hidden="true"
            />
            <span
              style={{
                fontSize: "12px",
                fontWeight: 500,
                color: "var(--text-primary)",
              }}
            >
              {market == null
                ? "Market status…"
                : market.open
                  ? "Market open"
                  : "Market closed"}
            </span>
          </div>
          <span
            className="font-mono uppercase"
            style={{
              fontSize: "9px",
              letterSpacing: "0.1em",
              color: "var(--text-muted)",
            }}
          >
            {market?.hint ?? ""}
          </span>
        </div>
      )}

      {/* Main navigation */}
      <nav className="dashboard-sidebar__nav" aria-label="Primary">
        {NAV.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="sidebar-item"
              data-active={active || undefined}
              aria-current={active ? "page" : undefined}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={16} aria-hidden="true" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Ask Pulse — separate group below main nav */}
      <nav
        className="dashboard-sidebar__nav"
        style={{ marginTop: "24px" }}
        aria-label="Assistant"
      >
        <button
          type="button"
          onClick={chat.toggle}
          aria-label={chat.open ? "Close Pulse Assistant" : "Open Pulse Assistant"}
          aria-expanded={chat.open}
          className="sidebar-item"
          data-active={chat.open || undefined}
          title={collapsed ? "Ask Pulse" : undefined}
        >
          <MessageSquare
            size={16}
            color="var(--accent-green)"
            aria-hidden="true"
          />
          {!collapsed && <span>Ask Pulse</span>}
        </button>
      </nav>

      {/* Upgrade card */}
      {!collapsed && (
        <div
          className="upgrade-card"
          style={{
            margin: "16px 14px",
            padding: "16px",
            borderRadius: "12px",
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--accent) 30%, var(--bg-elevated)), var(--bg-elevated))",
            border: "1px solid var(--border)",
          }}
        >
          <div style={{ position: "relative", zIndex: 1 }}>
            <Sparkles
              size={14}
              color="var(--accent)"
              aria-hidden="true"
              style={{ marginBottom: "8px" }}
            />
            <div
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: "2px",
              }}
            >
              Upgrade to Pulse Plus
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "var(--text-muted)",
                lineHeight: 1.4,
                marginBottom: "10px",
              }}
            >
              Unlock real-time data + unlimited AI chat
            </div>
            <Link
              href="/upgrade"
              className="font-mono uppercase"
              style={{
                display: "block",
                textAlign: "center",
                padding: "8px",
                borderRadius: "8px",
                background: "var(--accent)",
                color: "var(--text-primary)",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textDecoration: "none",
                transition: "opacity 150ms ease-out",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "0.9";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1";
              }}
            >
              Upgrade
            </Link>
          </div>
        </div>
      )}

      {/* Profile widget — bottom anchored */}
      <div
        style={{
          marginTop: "auto",
          margin: collapsed ? "auto 12px 12px" : "auto 14px 14px",
          padding: collapsed ? "8px" : "14px",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: collapsed ? "10px" : "12px",
          display: "flex",
          flexDirection: "column",
          gap: collapsed ? 0 : "12px",
          alignItems: collapsed ? "center" : undefined,
        }}
      >
        {/* Row 1: avatar + name/sub. When collapsed, only avatar shows. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            width: "100%",
            justifyContent: collapsed ? "center" : undefined,
          }}
        >
          <button
            type="button"
            onClick={collapsed ? handleSignOut : undefined}
            aria-label={collapsed ? "Sign out" : undefined}
            title={collapsed ? "Sign out" : undefined}
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              flexShrink: 0,
              cursor: collapsed ? "pointer" : "default",
              padding: 0,
            }}
          >
            {showAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl as string}
                alt={displayName}
                width={36}
                height={36}
                onError={() => setAvatarErrored(true)}
                style={{ width: 36, height: 36, objectFit: "cover" }}
              />
            ) : (
              <span
                style={{
                  color: "var(--text-primary)",
                  fontWeight: 700,
                  fontSize: 16,
                }}
              >
                {initial}
              </span>
            )}
          </button>
          {!collapsed && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "2px",
                minWidth: 0,
              }}
            >
              <span
                title={email ?? undefined}
                style={{
                  color: "var(--text-primary)",
                  fontWeight: 600,
                  fontSize: 14,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {displayName}
              </span>
              <span
                className="font-mono"
                style={{ color: "var(--text-muted)", fontSize: 11 }}
              >
                Free plan
              </span>
            </div>
          )}
        </div>

        {!collapsed && (
          <>
            {/* Row 2: placeholder profile-setup progress */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div
                style={{
                  height: 4,
                  background: "var(--bg-surface)",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: "60%",
                    height: "100%",
                    background: "var(--accent-green)",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    color: "var(--text-primary)",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  60%
                </span>
                <span
                  style={{ color: "var(--text-muted)", fontSize: 11 }}
                >
                  Complete setup ›
                </span>
              </div>
            </div>

            {/* Row 3: sign out */}
            <button
              type="button"
              onClick={handleSignOut}
              className="font-mono uppercase hover:text-text-primary"
              style={{
                fontSize: 11,
                letterSpacing: "0.1em",
                color: "var(--text-muted)",
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
                textAlign: "left",
                alignSelf: "flex-start",
                transition: "color 150ms ease",
              }}
            >
              Sign out
            </button>
          </>
        )}
      </div>
    </aside>
  );
}

