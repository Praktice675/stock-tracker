"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type HistoryPoint = {
  date: string;
  portfolioValue: number;
  spyValue: number;
};

type Timeframe = "1W" | "1M" | "3M" | "YTD" | "1Y" | "ALL";

const TIMEFRAMES: Timeframe[] = ["1W", "1M", "3M", "YTD", "1Y", "ALL"];
const ORANGE = "#ff6b3d";
const SPY_GRAY = "#888888";

function fmtAxisDollar(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtTooltipDollar(n: number): string {
  return (
    "$" +
    n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function fmtTickDate(s: string): string {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type Props = {
  hasTransactions: boolean;
};

export default function PortfolioChart({ hasTransactions }: Props) {
  const [timeframe, setTimeframe] = useState<Timeframe>("1M");
  const [showSpy, setShowSpy] = useState(false);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/portfolio/history?timeframe=${timeframe}`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : { history: [] }))
      .then((data) => {
        if (cancelled) return;
        setHistory(Array.isArray(data?.history) ? data.history : []);
      })
      .catch((err) => {
        console.warn("portfolio history fetch failed:", err);
        if (!cancelled) setHistory([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [timeframe]);

  const hasData = history.length > 0;
  const dotMode: false | { r: number; fill: string } =
    history.length === 1 ? { r: 3, fill: ORANGE } : false;
  const spyDot: false | { r: number; fill: string } =
    history.length === 1 ? { r: 3, fill: SPY_GRAY } : false;

  return (
    <div
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--border-radius)",
        padding: "16px",
        opacity: loading ? 0.6 : 1,
        transition: "opacity 200ms ease",
      }}
    >
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: "12px", gap: "12px", flexWrap: "wrap" }}
      >
        <h2
          className="font-mono uppercase"
          style={{
            fontSize: "11px",
            letterSpacing: "0.22em",
            color: "var(--text-muted)",
            margin: 0,
          }}
        >
          Portfolio Performance
        </h2>
        <div className="flex items-center" style={{ gap: "16px" }}>
          <button
            type="button"
            onClick={() => setShowSpy((v) => !v)}
            className="font-mono uppercase"
            style={{
              fontSize: "10px",
              letterSpacing: "0.15em",
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: "var(--border-radius)",
              padding: "6px 12px",
              color: showSpy
                ? "var(--accent)"
                : "var(--text-muted)",
              cursor: "pointer",
              transition: "color 150ms ease, border-color 150ms ease",
            }}
            aria-pressed={showSpy}
          >
            {showSpy ? "● " : "○ "}vs S&P 500
          </button>
          <div className="flex" style={{ gap: "2px" }}>
            {TIMEFRAMES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTimeframe(t)}
                className="font-mono uppercase"
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  letterSpacing: "0.18em",
                  padding: "6px 10px",
                  background: "transparent",
                  border: "none",
                  color:
                    t === timeframe ? "#FFFFFF" : "var(--text-muted)",
                  cursor: "pointer",
                  transition: "color 150ms ease",
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ height: "320px" }}>
        {!hasData && !loading ? (
          <div className="flex h-full items-center justify-center">
            <p
              className="text-text-muted"
              style={{
                fontSize: "12px",
                letterSpacing: "-0.015em",
              }}
            >
              {hasTransactions
                ? "Building your portfolio history…"
                : "Add transactions to see your portfolio history"}
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={history}
              margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
            >
              <CartesianGrid
                stroke="rgba(255, 255, 255, 0.04)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={fmtTickDate}
                tick={{
                  fill: "var(--text-muted)",
                  fontSize: 10,
                  fontFamily: "var(--font-mono), monospace",
                }}
                axisLine={false}
                tickLine={false}
                minTickGap={40}
              />
              <YAxis
                tickFormatter={fmtAxisDollar}
                tick={{
                  fill: "var(--text-muted)",
                  fontSize: 10,
                  fontFamily: "var(--font-mono), monospace",
                }}
                axisLine={false}
                tickLine={false}
                width={60}
                orientation="right"
                domain={["auto", "auto"]}
              />
              <Tooltip
                cursor={{ stroke: "rgba(255, 255, 255, 0.12)" }}
                contentStyle={{
                  backgroundColor: "rgb(var(--color-grey-800))",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--border-radius)",
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: "11px",
                }}
                labelStyle={{ color: "var(--text-muted)" }}
                itemStyle={{ color: "var(--text-primary)" }}
                labelFormatter={(label) => fmtTickDate(String(label))}
                formatter={(value, name) => {
                  const v = typeof value === "number" ? value : Number(value);
                  const safe = Number.isFinite(v) ? v : 0;
                  const label =
                    name === "portfolioValue" ? "Portfolio" : "S&P 500";
                  return [fmtTooltipDollar(safe), label];
                }}
              />
              <Line
                type="monotone"
                dataKey="portfolioValue"
                stroke={ORANGE}
                strokeWidth={2}
                dot={dotMode}
                isAnimationActive={false}
              />
              {showSpy && (
                <Line
                  type="monotone"
                  dataKey="spyValue"
                  stroke={SPY_GRAY}
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={spyDot}
                  isAnimationActive={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
