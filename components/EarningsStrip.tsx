"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type EarningsItem = {
  ticker: string;
  date: string;
  epsEstimate: number | null;
  time: "bmo" | "amc" | null;
};

export default function EarningsStrip() {
  const [earnings, setEarnings] = useState<EarningsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasUser, setHasUser] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let userId: string | null = null;
    let cancelled = false;

    async function loadEarnings() {
      if (!userId || cancelled) return;

      const { data: items } = await supabase
        .from("watchlist_items")
        .select("ticker");
      if (cancelled) return;

      const tickers = items?.map((i) => i.ticker) ?? [];
      if (tickers.length === 0) {
        setEarnings([]);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(
          `/api/earnings?tickers=${encodeURIComponent(tickers.join(","))}`,
        );
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          setEarnings(Array.isArray(data.earnings) ? data.earnings : []);
        }
      } catch (err) {
        console.error("EarningsStrip: fetch failed:", err);
      }
      setLoading(false);
    }

    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;

      if (!user) {
        setLoading(false);
        return;
      }

      userId = user.id;
      setHasUser(true);

      await loadEarnings();

      // Unique channel per mount — supabase.channel(name) returns the
      // existing channel for a repeated name, and calling .on() on an
      // already-subscribed channel throws. React 18 strict mode + fast
      // refresh both re-run this effect, so a stable name causes that
      // crash.
      const nonce = Math.random().toString(36).slice(2, 10);
      const channelName = `earnings-watchlist-${user.id}-${nonce}`;
      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "watchlist_items",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            loadEarnings();
          },
        )
        .subscribe();
    }

    init();

    return () => {
      cancelled = true;
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {
          // Channel may already be torn down by a previous cleanup pass.
        }
      }
    };
  }, []);

  if (loading) return null;
  if (!hasUser || earnings.length === 0) return null;

  return (
    <div className="earnings-strip">
      <div className="earnings-strip__label">EARNINGS THIS WEEK</div>
      <div className="earnings-strip__items">
        {earnings.map((item) => (
          <EarningsItemPill
            key={`${item.ticker}-${item.date}`}
            item={item}
          />
        ))}
      </div>
    </div>
  );
}

function EarningsItemPill({ item }: { item: EarningsItem }) {
  const daysUntil = getDaysUntil(item.date);
  const formatted = formatEarningsDate(item.date);
  const timeLabel =
    item.time === "bmo" ? "BMO" : item.time === "amc" ? "AMC" : null;

  return (
    <div className="earnings-pill">
      <span className="earnings-pill__ticker">{item.ticker}</span>
      <span className="earnings-pill__date">{formatted}</span>
      <span className="earnings-pill__days">
        {daysUntil === 0
          ? "today"
          : daysUntil === 1
            ? "tomorrow"
            : `in ${daysUntil}d`}
      </span>
      {timeLabel && <span className="earnings-pill__time">{timeLabel}</span>}
      {item.epsEstimate !== null && (
        <span className="earnings-pill__eps">
          EPS est ${item.epsEstimate.toFixed(2)}
        </span>
      )}
    </div>
  );
}

function getDaysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function formatEarningsDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
