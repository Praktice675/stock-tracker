"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { Holding } from "@/lib/portfolio/compute";

// Brand orange for the largest slice, then a complementary cycle.
const PALETTE = [
  "#FF6B1A",
  "#00D084",
  "#3F8CFF",
  "#A682FF",
  "#FF7AC6",
  "#FFD166",
  "#5BDBD0",
  "#9CA3AF",
];

const MAX_SLICES = 8;

type Slice = { name: string; value: number; color: string };

function buildSlices(holdings: Holding[]): Slice[] {
  const sorted = [...holdings].sort((a, b) => b.marketValue - a.marketValue);
  if (sorted.length <= MAX_SLICES) {
    return sorted.map((h, i) => ({
      name: h.ticker,
      value: h.marketValue,
      color: PALETTE[i % PALETTE.length],
    }));
  }
  const head = sorted.slice(0, MAX_SLICES - 1);
  const tail = sorted.slice(MAX_SLICES - 1);
  const tailValue = tail.reduce((s, h) => s + h.marketValue, 0);
  return [
    ...head.map((h, i) => ({
      name: h.ticker,
      value: h.marketValue,
      color: PALETTE[i],
    })),
    { name: "Others", value: tailValue, color: PALETTE[MAX_SLICES - 1] },
  ];
}

export default function AllocationChart({
  holdings,
}: {
  holdings: Holding[];
}) {
  const slices = buildSlices(holdings);
  const total = slices.reduce((s, x) => s + x.value, 0);

  return (
    <div
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--border-radius)",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        minHeight: "320px",
      }}
    >
      <div
        className="text-text-muted uppercase font-mono"
        style={{ fontSize: "10px", letterSpacing: "0.22em" }}
      >
        Allocation
      </div>

      <div style={{ width: "100%", height: "200px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius={50}
              outerRadius={85}
              paddingAngle={1}
              stroke="var(--bg-surface)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {slices.map((s) => (
                <Cell key={s.name} fill={s.color} />
              ))}
            </Pie>
            <Tooltip
              cursor={false}
              contentStyle={{
                backgroundColor: "rgb(var(--color-grey-800))",
                border: "1px solid var(--border)",
                borderRadius: "var(--border-radius)",
                fontFamily: "var(--font-mono), monospace",
                fontSize: "11px",
              }}
              labelStyle={{ color: "var(--text-muted)" }}
              itemStyle={{ color: "var(--text-primary)" }}
              formatter={(value, name) => {
                const v = typeof value === "number" ? value : Number(value);
                const safe = Number.isFinite(v) ? v : 0;
                const pct = total > 0 ? (safe / total) * 100 : 0;
                return [
                  `$${safe.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${pct.toFixed(1)}%)`,
                  String(name),
                ];
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-col" style={{ gap: "6px" }}>
        {slices.map((s) => {
          const pct = total > 0 ? (s.value / total) * 100 : 0;
          return (
            <div
              key={s.name}
              className="flex items-center justify-between"
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: "11px",
                letterSpacing: "-0.015em",
              }}
            >
              <div className="flex items-center" style={{ gap: "8px" }}>
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "2px",
                    backgroundColor: s.color,
                  }}
                />
                <span style={{ color: "var(--text-primary)" }}>{s.name}</span>
              </div>
              <span className="text-text-muted">{pct.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
