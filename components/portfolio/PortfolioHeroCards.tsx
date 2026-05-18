"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Info, Maximize2, TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Card from "@/components/ui/Card";
import CountUp from "@/components/ui/CountUp";

// ---------------------------------------------------------------------------
// Public data shape
// ---------------------------------------------------------------------------

export type HeroDistributionSegment = {
  symbol: string; // "Other" for the trailing bucket
  marketValue: number;
  percentOfTotal: number;
};

export type HeroSnapshot = {
  totalValue: number;
  takenAt: string;
};

export type MonthlyRealizedPoint = {
  month: string;
  monthIndex: number;
  stocks: number;
};

export type RealizedPnlData = {
  totalYtd: number;
  byMonth: MonthlyRealizedPoint[];
  hasData: boolean;
  hasCrypto: boolean;
  hasOther: boolean;
};

export type HeroData = {
  hasAnyPosition: boolean;
  totalValue: number;
  // Today's change (from snapshots, brokerage-only baseline)
  todayChangeAbs: number;
  todayChangePct: number;
  hasTodayChange: boolean;
  // YTD (or all-time fallback)
  ytdChangeAbs: number;
  ytdChangePct: number;
  ytdLabel: string; // "this year" | "all time" | ""
  hasYtdChange: boolean;
  // Distribution (top 4 + "Other")
  distribution: HeroDistributionSegment[];
  // Performance chart points (full history; range filtered client-side)
  allSnapshots: HeroSnapshot[];
  // Card C realized P&L (FIFO YTD)
  realized: RealizedPnlData;
};

type Props = {
  data: HeroData;
};

type ChartRange = "1D" | "1W" | "1M" | "3M" | "1Y";
const RANGES: ChartRange[] = ["1D", "1W", "1M", "3M", "1Y"];
const RANGE_MS: Record<ChartRange, number> = {
  "1D": 24 * 60 * 60 * 1000,
  "1W": 7 * 24 * 60 * 60 * 1000,
  "1M": 30 * 24 * 60 * 60 * 1000,
  "3M": 90 * 24 * 60 * 60 * 1000,
  "1Y": 365 * 24 * 60 * 60 * 1000,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DIST_COLORS = [
  "var(--accent)",
  "var(--accent-green)",
  "color-mix(in srgb, var(--accent) 50%, var(--bg-elevated))",
  "var(--text-muted)",
  "var(--bg-surface)",
];

const fmtCurrency = (n: number): string =>
  "$" +
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtCurrencyShort = (n: number): string => {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
};

const fmtSignedCurrency = (n: number): string => {
  const sign = n >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

function dateTickFormatter(snapshots: HeroSnapshot[]) {
  if (snapshots.length === 0) return (v: string) => v;
  const first = new Date(snapshots[0].takenAt).getTime();
  const last = new Date(snapshots[snapshots.length - 1].takenAt).getTime();
  const days = (last - first) / (1000 * 60 * 60 * 24);
  if (days <= 2) {
    return (iso: string) => {
      const d = new Date(iso);
      return Number.isNaN(d.getTime())
        ? iso
        : d.toLocaleTimeString("en-US", { hour: "numeric" });
    };
  }
  if (days <= 31) {
    return (iso: string) => {
      const d = new Date(iso);
      return Number.isNaN(d.getTime()) ? iso : String(d.getDate());
    };
  }
  return (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString("en-US", { month: "short" });
  };
}

// Zooms the Y-axis to (dataMin − 5%, dataMax + 5%) of the visible range so
// real movement is visible. Without this, recharts auto-zeros the baseline
// and a 2% swing looks like a flat line.
function zoomedYDomain(values: number[]): [number, number] {
  if (values.length === 0) return [0, 0];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return [min * 0.95, max * 1.05];
  }
  const pad = (max - min) * 0.05;
  return [min - pad, max + pad];
}

type TooltipShape = {
  active?: boolean;
  payload?: Array<{ value?: number | string; payload?: unknown }>;
  label?: string | number;
};

// ---------------------------------------------------------------------------
// Top-level layout
// ---------------------------------------------------------------------------

export default function PortfolioHeroCards({ data }: Props) {
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<ChartRange>("1M");

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 2fr",
        gap: "16px",
        marginBottom: "24px",
      }}
    >
      <TotalValueCard
        data={data}
        selectedSymbol={selectedSymbol}
        onSelectSymbol={setSelectedSymbol}
      />
      <PerformanceCard
        data={data}
        selectedSymbol={selectedSymbol}
        selectedRange={selectedRange}
        onClearSymbol={() => setSelectedSymbol(null)}
        onChangeRange={setSelectedRange}
      />
      <TotalProfitsCard data={data} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card A — Total Value + Distribution (clickable rows)
// ---------------------------------------------------------------------------

function TotalValueCard({
  data,
  selectedSymbol,
  onSelectSymbol,
}: {
  data: HeroData;
  selectedSymbol: string | null;
  onSelectSymbol: (sym: string | null) => void;
}) {
  const {
    totalValue,
    todayChangeAbs,
    todayChangePct,
    hasTodayChange,
    distribution,
    hasAnyPosition,
  } = data;

  return (
    <Card padding="24px" hoverable>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
        }}
      >
        <span
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "var(--text-primary)",
          }}
        >
          Total Value
        </span>
        <Info size={14} color="var(--text-muted)" aria-hidden="true" />
      </div>

      {hasAnyPosition ? (
        <>
          <div
            className="tabular-nums"
            style={{
              fontSize: "36px",
              fontWeight: 700,
              color: "var(--text-primary)",
              letterSpacing: "-0.015em",
              marginBottom: "14px",
            }}
          >
            <CountUp value={totalValue} decimals={2} />
          </div>

          <ChangeRow
            abs={todayChangeAbs}
            pct={todayChangePct}
            hasData={hasTodayChange}
            periodLabel="today"
            placeholder="Tracking begins today"
          />

          <DistributionBlock
            distribution={distribution}
            selectedSymbol={selectedSymbol}
            onSelectSymbol={onSelectSymbol}
          />
        </>
      ) : (
        <EmptyState text="Connect a brokerage to see your portfolio." centered />
      )}
    </Card>
  );
}

function ChangeRow({
  abs,
  pct,
  hasData,
  periodLabel,
  placeholder,
}: {
  abs: number;
  pct: number;
  hasData: boolean;
  periodLabel: string;
  placeholder: string;
}) {
  if (!hasData) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "24px",
        }}
      >
        <span
          className="font-mono tabular-nums"
          style={{
            background:
              "color-mix(in srgb, var(--text-muted) 15%, transparent)",
            color: "var(--text-muted)",
            padding: "3px 8px",
            borderRadius: "6px",
            fontSize: "11px",
            fontWeight: 700,
          }}
        >
          —
        </span>
        <span
          style={{ fontSize: "13px", color: "var(--text-muted)" }}
        >
          {placeholder}
        </span>
      </div>
    );
  }

  const positive = abs >= 0;
  const pillBg = positive
    ? "color-mix(in srgb, var(--accent-green) 15%, transparent)"
    : "color-mix(in srgb, var(--accent-red) 15%, transparent)";
  const color = positive ? "var(--accent-green)" : "var(--accent-red)";
  const arrow = positive ? "↑" : "↓";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginBottom: "24px",
      }}
    >
      <span
        className="font-mono tabular-nums"
        style={{
          background: pillBg,
          color,
          padding: "3px 8px",
          borderRadius: "6px",
          fontSize: "11px",
          fontWeight: 700,
        }}
      >
        {arrow} {Math.abs(pct).toFixed(2)}%
      </span>
      <span
        className="tabular-nums"
        style={{ fontSize: "13px", color }}
      >
        {fmtSignedCurrency(abs)} {periodLabel}
      </span>
    </div>
  );
}

function DistributionBlock({
  distribution,
  selectedSymbol,
  onSelectSymbol,
}: {
  distribution: HeroDistributionSegment[];
  selectedSymbol: string | null;
  onSelectSymbol: (sym: string | null) => void;
}) {
  if (distribution.length === 0) return null;

  return (
    <div>
      <div
        style={{
          fontSize: "13px",
          fontWeight: 600,
          color: "var(--text-primary)",
          marginBottom: "10px",
        }}
      >
        Distribution
      </div>

      {/* Multi-segment bar */}
      <div
        style={{
          width: "100%",
          height: "8px",
          borderRadius: "4px",
          overflow: "hidden",
          background: "var(--bg-surface)",
          display: "flex",
          marginBottom: "10px",
        }}
      >
        {distribution.map((seg, i) => (
          <div
            key={`${seg.symbol}-${i}`}
            style={{
              width: `${seg.percentOfTotal}%`,
              height: "100%",
              background: DIST_COLORS[i % DIST_COLORS.length],
            }}
            aria-hidden="true"
          />
        ))}
      </div>

      {/* Clickable legend */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {distribution.map((seg, i) => {
          // "Other" can't drill into a single chart — leave it inert.
          const isClickable = seg.symbol !== "Other";
          const isSelected =
            isClickable && selectedSymbol === seg.symbol;
          return (
            <DistributionRow
              key={`row-${seg.symbol}-${i}`}
              seg={seg}
              color={DIST_COLORS[i % DIST_COLORS.length]}
              isLast={i === distribution.length - 1}
              isClickable={isClickable}
              isSelected={isSelected}
              onClick={
                isClickable
                  ? () =>
                      onSelectSymbol(
                        selectedSymbol === seg.symbol ? null : seg.symbol,
                      )
                  : undefined
              }
            />
          );
        })}
      </div>
    </div>
  );
}

function DistributionRow({
  seg,
  color,
  isLast,
  isClickable,
  isSelected,
  onClick,
}: {
  seg: HeroDistributionSegment;
  color: string;
  isLast: boolean;
  isClickable: boolean;
  isSelected: boolean;
  onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  // Negative left margin compensates for the row padding so the hover/selected
  // background extends edge-to-edge inside the card, with a 2px accent strip
  // on the left when selected.
  return (
    <div
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onMouseEnter={() => isClickable && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onKeyDown={(e) => {
        if (!isClickable || !onClick) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 8px 8px 10px",
        marginLeft: "-10px",
        marginRight: "-8px",
        borderLeft: isSelected
          ? "2px solid var(--accent)"
          : "2px solid transparent",
        borderBottom: isLast ? "none" : "1px solid var(--border)",
        background:
          isSelected || hovered ? "var(--bg-elevated)" : "transparent",
        cursor: isClickable ? "pointer" : "default",
        transition: "background-color 120ms ease-out",
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
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: color,
            flexShrink: 0,
          }}
          aria-hidden="true"
        />
        <span
          style={{
            fontSize: "12px",
            fontWeight: 700,
            color: isSelected
              ? "var(--accent)"
              : "var(--text-primary)",
          }}
        >
          {seg.symbol}
        </span>
        <span
          className="tabular-nums"
          style={{ fontSize: "11px", color: "var(--text-muted)" }}
        >
          {seg.percentOfTotal.toFixed(0)}%
        </span>
      </div>
      <span
        className="tabular-nums"
        style={{ fontSize: "12px", color: "var(--text-primary)" }}
      >
        {fmtCurrencyShort(seg.marketValue)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card B — Portfolio Performance with drill-down + range pills
// ---------------------------------------------------------------------------

function PerformanceCard({
  data,
  selectedSymbol,
  selectedRange,
  onClearSymbol,
  onChangeRange,
}: {
  data: HeroData;
  selectedSymbol: string | null;
  selectedRange: ChartRange;
  onClearSymbol: () => void;
  onChangeRange: (r: ChartRange) => void;
}) {
  const {
    totalValue,
    ytdChangeAbs,
    ytdChangePct,
    ytdLabel,
    hasYtdChange,
    allSnapshots,
    hasAnyPosition,
  } = data;

  const inSymbolMode = selectedSymbol != null;

  // Portfolio snapshots filtered to the selected range
  const filteredSnapshots = useMemo(() => {
    if (allSnapshots.length === 0) return [];
    const cutoff = Date.now() - RANGE_MS[selectedRange];
    const filtered = allSnapshots.filter(
      (s) => new Date(s.takenAt).getTime() >= cutoff,
    );
    // Always render at least the trailing 2 points if the user has any data,
    // even if both fall outside the range (e.g. tiny 1D range with no recent
    // ticks). Recharts looks dead with a single point.
    if (filtered.length < 2 && allSnapshots.length >= 2) {
      return allSnapshots.slice(-2);
    }
    return filtered;
  }, [allSnapshots, selectedRange]);

  return (
    <Card padding="24px" hoverable>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {inSymbolMode && (
            <button
              type="button"
              onClick={onClearSymbol}
              aria-label="Back to portfolio"
              title="Back to portfolio"
              style={{
                width: 24,
                height: 24,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: 0,
                transition:
                  "color 150ms ease-out, border-color 150ms ease-out",
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
              <ArrowLeft size={12} aria-hidden="true" />
            </button>
          )}
          <span
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            {inSymbolMode
              ? `${selectedSymbol} • ${selectedRange}`
              : "Portfolio Performance"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <RangePills value={selectedRange} onChange={onChangeRange} />
          <TrendingUp
            size={14}
            color="var(--text-muted)"
            aria-hidden="true"
          />
        </div>
      </div>

      {!hasAnyPosition ? (
        <EmptyState
          text="Connect a brokerage to see your performance over time."
          centered
        />
      ) : inSymbolMode ? (
        <SymbolChart
          key={`${selectedSymbol}-${selectedRange}`}
          symbol={selectedSymbol as string}
          range={selectedRange}
        />
      ) : (
        <>
          <div
            className="tabular-nums"
            style={{
              fontSize: "28px",
              fontWeight: 700,
              color: "var(--text-primary)",
              letterSpacing: "-0.015em",
              marginBottom: "10px",
            }}
          >
            <CountUp value={totalValue} decimals={2} />
          </div>

          <ChangeRow
            abs={ytdChangeAbs}
            pct={ytdChangePct}
            hasData={hasYtdChange}
            periodLabel={`in ${ytdLabel || "this year"}`}
            placeholder="Tracking will begin shortly"
          />

          <PortfolioPerformanceChart snapshots={filteredSnapshots} />
        </>
      )}
    </Card>
  );
}

function RangePills({
  value,
  onChange,
}: {
  value: ChartRange;
  onChange: (r: ChartRange) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "3px",
        gap: "2px",
      }}
    >
      {RANGES.map((r) => {
        const active = r === value;
        return (
          <button
            key={r}
            type="button"
            onClick={() => onChange(r)}
            className="font-mono uppercase"
            style={{
              padding: "4px 10px",
              borderRadius: "6px",
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.12em",
              background: active ? "var(--bg-surface)" : "transparent",
              color: active ? "var(--text-primary)" : "var(--text-muted)",
              border: "none",
              cursor: "pointer",
              transition: "all 150ms",
              fontFamily: "var(--font-mono), monospace",
            }}
          >
            {r}
          </button>
        );
      })}
    </div>
  );
}

function PortfolioPerformanceChart({
  snapshots,
}: {
  snapshots: HeroSnapshot[];
}) {
  const tickFmt = useMemo(() => dateTickFormatter(snapshots), [snapshots]);
  const yDomain = useMemo(
    () => zoomedYDomain(snapshots.map((s) => s.totalValue)),
    [snapshots],
  );

  if (snapshots.length < 2) {
    return (
      <div
        style={{
          height: "240px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
          fontSize: "13px",
        }}
      >
        Tracking will begin once you have multiple data points.
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "240px" }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={snapshots}
          margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id="pulse-perf-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--accent)"
                stopOpacity={0.3}
              />
              <stop
                offset="100%"
                stopColor="var(--accent)"
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="takenAt"
            tickFormatter={tickFmt}
            tick={{
              fill: "var(--text-muted)",
              fontSize: 10,
              fontFamily: "var(--font-mono), monospace",
            }}
            axisLine={false}
            tickLine={false}
            minTickGap={32}
          />
          <YAxis
            tickFormatter={(v) =>
              typeof v === "number" ? fmtCurrencyShort(v) : ""
            }
            tick={{
              fill: "var(--text-muted)",
              fontSize: 10,
              fontFamily: "var(--font-mono), monospace",
            }}
            axisLine={false}
            tickLine={false}
            width={48}
            orientation="right"
            domain={yDomain}
          />
          <Tooltip
            content={<PerformanceTooltip />}
            cursor={{ stroke: "rgba(255,255,255,0.12)" }}
          />
          <Area
            type="monotone"
            dataKey="totalValue"
            stroke="var(--accent)"
            strokeWidth={2}
            fill="url(#pulse-perf-gradient)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function PerformanceTooltip(props: TooltipShape) {
  const { active, payload, label } = props;
  if (!active || !payload || payload.length === 0) return null;
  const raw = payload[0]?.value;
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value)) return null;
  const d = new Date(String(label));
  const niceDate = Number.isNaN(d.getTime())
    ? String(label)
    : d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "8px 12px",
        fontSize: "12px",
      }}
    >
      <div
        style={{
          color: "var(--text-muted)",
          marginBottom: "2px",
          fontFamily: "var(--font-mono), monospace",
        }}
      >
        {niceDate}
      </div>
      <div
        className="tabular-nums"
        style={{ color: "var(--text-primary)", fontWeight: 600 }}
      >
        {fmtCurrency(value)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SymbolChart — single-stock candle drill-down
// ---------------------------------------------------------------------------

type Candle = {
  time: string | number;
  close: number;
};

function SymbolChart({
  symbol,
  range,
}: {
  symbol: string;
  range: ChartRange;
}) {
  const [candles, setCandles] = useState<Candle[] | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setCandles(null);
    fetch(`/api/candles/${symbol}?timeframe=${range}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled) return;
        if (Array.isArray(json)) {
          setCandles(
            json
              .filter(
                (c: { time?: unknown; close?: unknown }) =>
                  (typeof c?.time === "string" ||
                    typeof c?.time === "number") &&
                  typeof c?.close === "number" &&
                  Number.isFinite(c.close),
              )
              .map((c: { time: string | number; close: number }) => ({
                time: c.time,
                close: c.close,
              })),
          );
        } else {
          setCandles([]);
        }
        setLoaded(true);
      })
      .catch((err) => {
        console.warn(`Symbol candles ${symbol}/${range} failed:`, err);
        if (!cancelled) {
          setCandles([]);
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, range]);

  if (!loaded) {
    return (
      <div
        style={{
          height: "316px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
          fontSize: "13px",
        }}
      >
        Loading {symbol}…
      </div>
    );
  }

  if (!candles || candles.length < 2) {
    return (
      <div
        style={{
          height: "316px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
          fontSize: "13px",
        }}
      >
        No candle data for {symbol} at {range}.
      </div>
    );
  }

  const first = candles[0].close;
  const last = candles[candles.length - 1].close;
  const positive = last >= first;
  const changeAbs = last - first;
  const changePct = first > 0 ? (changeAbs / first) * 100 : 0;
  const strokeColor = positive
    ? "var(--accent-green)"
    : "var(--accent-red)";
  const yDomain = zoomedYDomain(candles.map((c) => c.close));

  // Pick a tick formatter based on time type:
  //  - 1D / 1W use intraday unix seconds → "9:30 AM" style
  //  - 1M / 3M / 1Y use "YYYY-MM-DD" → day / month label
  const isIntraday = typeof candles[0].time === "number";
  const tickFmt = (v: string | number) => {
    if (isIntraday && typeof v === "number") {
      const d = new Date(v * 1000);
      return d.toLocaleTimeString("en-US", {
        hour: "numeric",
      });
    }
    const d = new Date(String(v));
    if (Number.isNaN(d.getTime())) return String(v);
    if (range === "1Y") {
      return d.toLocaleDateString("en-US", { month: "short" });
    }
    return String(d.getDate());
  };

  return (
    <>
      <div
        className="tabular-nums"
        style={{
          fontSize: "28px",
          fontWeight: 700,
          color: "var(--text-primary)",
          letterSpacing: "-0.015em",
          marginBottom: "10px",
        }}
      >
        {fmtCurrency(last)}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "24px",
        }}
      >
        <span
          className="font-mono tabular-nums"
          style={{
            background: positive
              ? "color-mix(in srgb, var(--accent-green) 15%, transparent)"
              : "color-mix(in srgb, var(--accent-red) 15%, transparent)",
            color: strokeColor,
            padding: "3px 8px",
            borderRadius: "6px",
            fontSize: "11px",
            fontWeight: 700,
          }}
        >
          {positive ? "↑" : "↓"} {Math.abs(changePct).toFixed(2)}%
        </span>
        <span
          className="tabular-nums"
          style={{ fontSize: "13px", color: strokeColor }}
        >
          {fmtSignedCurrency(changeAbs)} over {range}
        </span>
      </div>

      <div style={{ width: "100%", height: "240px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={candles}
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient
                id={`pulse-symbol-gradient-${positive ? "up" : "down"}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor={strokeColor}
                  stopOpacity={0.3}
                />
                <stop
                  offset="100%"
                  stopColor={strokeColor}
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              tickFormatter={tickFmt}
              tick={{
                fill: "var(--text-muted)",
                fontSize: 10,
                fontFamily: "var(--font-mono), monospace",
              }}
              axisLine={false}
              tickLine={false}
              minTickGap={32}
            />
            <YAxis
              tickFormatter={(v) =>
                typeof v === "number" ? fmtCurrencyShort(v) : ""
              }
              tick={{
                fill: "var(--text-muted)",
                fontSize: 10,
                fontFamily: "var(--font-mono), monospace",
              }}
              axisLine={false}
              tickLine={false}
              width={48}
              orientation="right"
              domain={yDomain}
            />
            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,0.12)" }}
              content={(p: unknown) => (
                <SymbolTooltip
                  symbol={symbol}
                  {...(p as TooltipShape)}
                />
              )}
            />
            <Area
              type="monotone"
              dataKey="close"
              stroke={strokeColor}
              strokeWidth={2}
              fill={`url(#pulse-symbol-gradient-${positive ? "up" : "down"})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

function SymbolTooltip({
  symbol,
  active,
  payload,
  label,
}: TooltipShape & { symbol: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const raw = payload[0]?.value;
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value)) return null;
  const niceLabel = (() => {
    const v = label;
    if (typeof v === "number") {
      const d = new Date(v * 1000);
      return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    }
    const d = new Date(String(v));
    return Number.isNaN(d.getTime())
      ? String(v)
      : d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
  })();
  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "8px 12px",
        fontSize: "12px",
      }}
    >
      <div
        style={{
          color: "var(--text-muted)",
          marginBottom: "2px",
          fontFamily: "var(--font-mono), monospace",
        }}
      >
        {symbol} • {niceLabel}
      </div>
      <div
        className="tabular-nums"
        style={{ color: "var(--text-primary)", fontWeight: 600 }}
      >
        {fmtCurrency(value)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card C — Total Profits (realized YTD by month)
// ---------------------------------------------------------------------------

function TotalProfitsCard({ data }: { data: HeroData }) {
  const { realized, totalValue } = data;
  const positive = realized.totalYtd >= 0;
  const pillBg = positive
    ? "color-mix(in srgb, var(--accent-green) 15%, transparent)"
    : "color-mix(in srgb, var(--accent-red) 15%, transparent)";
  const color = positive ? "var(--accent-green)" : "var(--accent-red)";
  const arrow = positive ? "↑" : "↓";
  // pct relative to current portfolio value (closest proxy without a separate
  // YTD cost basis). Zero when there's no portfolio to compare against.
  const pct = totalValue > 0 ? (realized.totalYtd / totalValue) * 100 : 0;

  return (
    <Card padding="24px" hoverable style={{ gridColumn: "1 / -1" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            Total Profits
          </span>
          <Info size={14} color="var(--text-muted)" aria-hidden="true" />
        </div>
        <button
          type="button"
          aria-label="Open fullscreen"
          title="Open fullscreen"
          style={{
            width: 24,
            height: 24,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            color: "var(--text-muted)",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <Maximize2 size={14} aria-hidden="true" />
        </button>
      </div>

      {!realized.hasData ? (
        <EmptyState
          text="No realized profits yet — make a trade to start tracking."
          centered
          large
        />
      ) : (
        <>
          <div
            className="tabular-nums"
            style={{
              fontSize: "28px",
              fontWeight: 700,
              color: "var(--text-primary)",
              letterSpacing: "-0.015em",
              marginBottom: "6px",
            }}
          >
            <CountUp value={Math.abs(realized.totalYtd)} decimals={2} />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
              marginBottom: "20px",
            }}
          >
            <div
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
            >
              <span
                className="font-mono tabular-nums"
                style={{
                  background: pillBg,
                  color,
                  padding: "3px 8px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: 700,
                }}
              >
                {arrow} {Math.abs(pct).toFixed(2)}%
              </span>
              <span
                className="tabular-nums"
                style={{ fontSize: "13px", color }}
              >
                {fmtSignedCurrency(realized.totalYtd)} in this year
              </span>
            </div>
            <ProfitsLegend realized={realized} />
          </div>

          <ProfitsBarChart byMonth={realized.byMonth} />
        </>
      )}
    </Card>
  );
}

function ProfitsLegend({ realized }: { realized: RealizedPnlData }) {
  const items: Array<{ color: string; label: string }> = [];
  if (realized.byMonth.some((m) => m.stocks !== 0)) {
    items.push({ color: "var(--accent)", label: "Stocks" });
  }
  if (realized.hasCrypto) {
    items.push({ color: "var(--accent-green)", label: "Crypto" });
  }
  if (realized.hasOther) {
    items.push({ color: "var(--text-muted)", label: "Other" });
  }
  if (items.length === 0) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        fontSize: "11px",
        color: "var(--text-muted)",
      }}
    >
      {items.map((it) => (
        <span
          key={it.label}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: it.color,
              display: "inline-block",
            }}
            aria-hidden="true"
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}

function ProfitsBarChart({
  byMonth,
}: {
  byMonth: MonthlyRealizedPoint[];
}) {
  if (byMonth.length === 0) return null;
  return (
    <div style={{ width: "100%", height: "240px" }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={byMonth}
          margin={{ top: 24, right: 4, bottom: 0, left: 0 }}
        >
          <XAxis
            dataKey="month"
            tick={{
              fill: "var(--text-muted)",
              fontSize: 11,
              fontFamily: "var(--font-mono), monospace",
            }}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <YAxis hide domain={["auto", "auto"]} />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            content={<ProfitsTooltip />}
          />
          <Bar
            dataKey="stocks"
            fill="var(--accent)"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="stocks"
              position="top"
              content={(props) => {
                const { x, y, width, value } = props as {
                  x?: number;
                  y?: number;
                  width?: number;
                  value?: number;
                };
                if (
                  typeof x !== "number" ||
                  typeof y !== "number" ||
                  typeof width !== "number" ||
                  typeof value !== "number"
                ) {
                  return null;
                }
                return (
                  <text
                    x={x + width / 2}
                    y={y - 6}
                    textAnchor="middle"
                    fill="var(--text-primary)"
                    fontSize={11}
                    fontFamily="var(--font-mono), monospace"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {fmtCurrencyShort(value)}
                  </text>
                );
              }}
            />
            {byMonth.map((m, i) => (
              <Cell
                key={`profit-cell-${m.monthIndex}-${i}`}
                fill={
                  m.stocks >= 0
                    ? "var(--accent)"
                    : "var(--accent-red)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ProfitsTooltip(props: TooltipShape) {
  const { active, payload, label } = props;
  if (!active || !payload || payload.length === 0) return null;
  const raw = payload[0]?.value;
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value)) return null;
  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "10px",
        fontSize: "12px",
        minWidth: "160px",
      }}
    >
      <div
        style={{
          color: "var(--text-muted)",
          marginBottom: "6px",
          fontFamily: "var(--font-mono), monospace",
        }}
      >
        {String(label ?? "")} • realized
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "var(--accent)",
          }}
          aria-hidden="true"
        />
        <span style={{ color: "var(--text-muted)" }}>Stocks</span>
        <span
          className="tabular-nums"
          style={{
            color: "var(--text-primary)",
            fontWeight: 600,
            marginLeft: "auto",
          }}
        >
          {fmtSignedCurrency(value)}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared empty state
// ---------------------------------------------------------------------------

function EmptyState({
  text,
  centered,
  large,
}: {
  text: string;
  centered?: boolean;
  large?: boolean;
}) {
  return (
    <div
      style={{
        fontSize: large ? "14px" : "13px",
        color: "var(--text-muted)",
        lineHeight: 1.5,
        padding: large ? "40px 0" : centered ? "24px 0" : "8px 0",
        textAlign: centered ? "center" : undefined,
      }}
    >
      {text}
    </div>
  );
}
