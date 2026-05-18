// lib/portfolio/realized-pnl.ts
//
// Server-side helper for the portfolio Hero Card C ("Total Profits") YTD chart.
// Walks brokerage_activities for the current user and matches BUY/SELL pairs
// via FIFO to compute realized P&L per SELL event, then aggregates by month
// for the current calendar year.

import { createClient } from "@/lib/supabase/server";

export type MonthlyRealizedPoint = {
  month: string; // "Jan" … "Dec"
  monthIndex: number; // 0-11
  stocks: number; // realized $ this month from equity SELLs
};

export type RealizedPnlData = {
  totalYtd: number;
  byMonth: MonthlyRealizedPoint[];
  hasData: boolean;
  // Future asset classes — currently always false (Pulse is equity-only)
  hasCrypto: boolean;
  hasOther: boolean;
};

type ActivityRow = {
  type: string | null;
  symbol: string | null;
  quantity: number | null;
  price: number | null;
  trade_date: string | null;
};

type Lot = { qty: number; price: number };

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const EMPTY: RealizedPnlData = {
  totalYtd: 0,
  byMonth: [],
  hasData: false,
  hasCrypto: false,
  hasOther: false,
};

// FIFO matching: each SELL consumes earlier BUY lots in chronological order
// from the same symbol's queue. Realized = matched_qty × (sell_price − buy_price)
// summed across the lots that were consumed.
//
// If a SELL exceeds the buy history we know about (e.g. shares brought in from
// before SnapTrade was connected), the unmatched portion is dropped silently —
// we can't compute realized without a cost basis, and zero is closer to the
// truth than a wild guess.
function computeRealizedEvents(activities: ActivityRow[]): Array<{
  symbol: string;
  tradeDate: string;
  realized: number;
}> {
  const sorted = activities
    .filter(
      (a): a is ActivityRow & { symbol: string; trade_date: string } =>
        typeof a.symbol === "string" &&
        a.symbol.length > 0 &&
        typeof a.trade_date === "string" &&
        a.trade_date.length > 0 &&
        typeof a.quantity === "number" &&
        a.quantity > 0 &&
        typeof a.price === "number" &&
        a.price > 0,
    )
    .sort((a, b) => a.trade_date.localeCompare(b.trade_date));

  const lotsBySymbol = new Map<string, Lot[]>();
  const events: Array<{ symbol: string; tradeDate: string; realized: number }> =
    [];

  for (const a of sorted) {
    const sym = a.symbol;
    const qty = a.quantity as number;
    const price = a.price as number;
    const type = (a.type ?? "").toUpperCase();

    if (type === "BUY") {
      const lots = lotsBySymbol.get(sym) ?? [];
      lots.push({ qty, price });
      lotsBySymbol.set(sym, lots);
    } else if (type === "SELL") {
      const lots = lotsBySymbol.get(sym) ?? [];
      let remaining = qty;
      let realized = 0;
      while (remaining > 1e-9 && lots.length > 0) {
        const lot = lots[0];
        const matched = Math.min(lot.qty, remaining);
        realized += matched * (price - lot.price);
        lot.qty -= matched;
        remaining -= matched;
        if (lot.qty <= 1e-9) lots.shift();
      }
      // Unmatched remainder (no buy history) is dropped silently.
      events.push({ symbol: sym, tradeDate: a.trade_date, realized });
      lotsBySymbol.set(sym, lots);
    }
  }

  return events;
}

export async function getRealizedPnlYtd(): Promise<RealizedPnlData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return EMPTY;

  // Pull everything — FIFO matching needs the full history for an accurate
  // cost basis, not just current year.
  const { data, error } = await supabase
    .from("brokerage_activities")
    .select("type, symbol, quantity, price, trade_date")
    .eq("user_id", user.id)
    .in("type", ["BUY", "SELL", "buy", "sell", "Buy", "Sell"]);

  if (error) {
    console.warn("getRealizedPnlYtd select failed:", error.message);
    return EMPTY;
  }

  const activities = (data ?? []) as ActivityRow[];
  if (activities.length === 0) return EMPTY;

  const events = computeRealizedEvents(activities);
  if (events.length === 0) return EMPTY;

  const currentYear = new Date().getFullYear();
  const monthly = new Map<number, number>();
  for (const e of events) {
    const d = new Date(e.tradeDate);
    if (Number.isNaN(d.getTime())) continue;
    if (d.getFullYear() !== currentYear) continue;
    const m = d.getMonth();
    monthly.set(m, (monthly.get(m) ?? 0) + e.realized);
  }

  if (monthly.size === 0) {
    return { ...EMPTY };
  }

  const byMonth: MonthlyRealizedPoint[] = Array.from(monthly.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([idx, value]) => ({
      month: MONTH_NAMES[idx],
      monthIndex: idx,
      stocks: value,
    }));

  const totalYtd = byMonth.reduce((s, m) => s + m.stocks, 0);

  return {
    totalYtd,
    byMonth,
    hasData: true,
    hasCrypto: false,
    hasOther: false,
  };
}
