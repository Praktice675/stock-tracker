"use client";

import { useEffect, useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Card from "@/components/ui/Card";

type Point = { totalValue: number; takenAt: string };

type ApiResponse = { points?: Point[] };

const POSITIVE = "#00FF94";
const NEGATIVE = "#FF3B5C";

function fmtMoney(n: number): string {
  return (
    "$" +
    n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function IntradayPortfolioChart() {
  const [points, setPoints] = useState<Point[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/portfolio/snapshot", {
          cache: "no-store",
        });
        if (cancelled || !res.ok) return;
        const json = (await res.json()) as ApiResponse;
        if (cancelled) return;
        setPoints(Array.isArray(json.points) ? json.points : []);
      } catch (err) {
        console.warn("Snapshot GET failed:", err);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };

    const record = async () => {
      try {
        const res = await fetch("/api/portfolio/snapshot", { method: "POST" });
        if (cancelled || !res.ok) return;
        await load();
      } catch (err) {
        console.warn("Snapshot POST failed:", err);
      }
    };

    // Initial: load any existing snapshots, then record a new point so the
    // user immediately sees their current value on the chart.
    void (async () => {
      await load();
      if (cancelled) return;
      await record();
    })();

    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      void record();
    };

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

  const hasEnough = points.length >= 2;
  const current = points.length > 0 ? points[points.length - 1].totalValue : 0;
  const first = points.length > 0 ? points[0].totalValue : 0;
  const deltaAbs = current - first;
  const deltaPct = first > 0 ? (deltaAbs / first) * 100 : 0;
  const isPositive = deltaAbs >= 0;
  const lineColor = isPositive ? POSITIVE : NEGATIVE;

  return (
    <Card style={{ marginTop: "24px" }}>
      <div
        className="flex items-center"
        style={{ justifyContent: "space-between", marginBottom: "16px" }}
      >
        <h2
          className="font-mono uppercase"
          style={{
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.25em",
            color: "var(--text-muted)",
            margin: 0,
          }}
        >
          Portfolio Today
        </h2>
      </div>

      <div style={{ height: "240px" }}>
        {!loaded ? (
          <div
            className="flex h-full items-center justify-center"
            style={{
              color: "var(--text-muted)",
              fontSize: "12px",
              letterSpacing: "-0.015em",
            }}
          >
            Loading…
          </div>
        ) : !hasEnough ? (
          <div
            className="flex h-full items-center justify-center"
            style={{
              color: "var(--text-muted)",
              fontSize: "12px",
              letterSpacing: "-0.015em",
            }}
          >
            Tracking will begin once you have data.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={points}
              margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
            >
              <XAxis
                dataKey="takenAt"
                tickFormatter={fmtTime}
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
                tickFormatter={(v) =>
                  typeof v === "number" ? `$${Math.round(v).toLocaleString()}` : ""
                }
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
                  backgroundColor: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--border-radius)",
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: "11px",
                }}
                labelStyle={{ color: "var(--text-muted)" }}
                itemStyle={{ color: "var(--text-primary)" }}
                labelFormatter={(label) => fmtTime(String(label))}
                formatter={(value) => {
                  const v = typeof value === "number" ? value : Number(value);
                  return [fmtMoney(Number.isFinite(v) ? v : 0), "Value"];
                }}
              />
              <Line
                type="monotone"
                dataKey="totalValue"
                stroke={lineColor}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {hasEnough && (
        <div
          className="flex items-baseline"
          style={{ gap: "12px", marginTop: "16px" }}
        >
          <span
            className="font-mono"
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: "var(--text-primary)",
              letterSpacing: "-0.015em",
            }}
          >
            {fmtMoney(current)}
          </span>
          <span
            className="font-mono"
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: lineColor,
              letterSpacing: "-0.015em",
            }}
          >
            {isPositive ? "+" : ""}
            {fmtMoney(deltaAbs)} ({isPositive ? "+" : ""}
            {deltaPct.toFixed(2)}%)
          </span>
        </div>
      )}
    </Card>
  );
}
