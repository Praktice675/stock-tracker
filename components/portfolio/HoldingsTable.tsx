"use client";

import { useMemo, useState } from "react";
import type { Holding } from "@/lib/portfolio/compute";

const POSITIVE = "#00FF94";
const NEGATIVE = "#FF3B5C";

type SortKey =
  | "ticker"
  | "shares"
  | "avgCost"
  | "currentPrice"
  | "marketValue"
  | "gainLossDollar"
  | "gainLossPercent"
  | "allocationPercent";

type SortDir = "asc" | "desc";

function fmtMoney(n: number, signed = false): string {
  const sign = n < 0 ? "-" : signed ? "+" : "";
  return (
    sign +
    "$" +
    Math.abs(n).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function fmtShares(n: number): string {
  // Up to 4 decimals, trim trailing zeros.
  return parseFloat(n.toFixed(4)).toString();
}

function fmtPct(n: number, signed = true): string {
  const sign = n < 0 ? "" : signed ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function plColor(n: number): string {
  if (n > 0) return POSITIVE;
  if (n < 0) return NEGATIVE;
  return "var(--text-primary)";
}

export default function HoldingsTable({ holdings }: { holdings: Holding[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("marketValue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const arr = [...holdings];
    arr.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sortKey === "ticker") {
        av = a.ticker;
        bv = b.ticker;
        return sortDir === "asc"
          ? (av as string).localeCompare(bv as string)
          : (bv as string).localeCompare(av as string);
      }
      av = a[sortKey] as number;
      bv = b[sortKey] as number;
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return arr;
  }, [holdings, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "ticker" ? "asc" : "desc");
    }
  };

  return (
    <div
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--border-radius)",
        overflowX: "auto",
      }}
    >
      <table
        className="w-full"
        style={{
          borderCollapse: "collapse",
          fontFamily: "var(--font-mono), monospace",
          fontSize: "12px",
        }}
      >
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            <Th
              label="Ticker"
              col="ticker"
              sortKey={sortKey}
              sortDir={sortDir}
              onClick={toggleSort}
              align="left"
            />
            <th
              className="text-text-muted uppercase text-left"
              style={{
                padding: "10px 12px",
                fontSize: "10px",
                letterSpacing: "0.18em",
                fontWeight: 600,
              }}
            >
              Name
            </th>
            <Th
              label="Shares"
              col="shares"
              sortKey={sortKey}
              sortDir={sortDir}
              onClick={toggleSort}
              align="right"
            />
            <Th
              label="Avg Cost"
              col="avgCost"
              sortKey={sortKey}
              sortDir={sortDir}
              onClick={toggleSort}
              align="right"
            />
            <Th
              label="Current"
              col="currentPrice"
              sortKey={sortKey}
              sortDir={sortDir}
              onClick={toggleSort}
              align="right"
            />
            <Th
              label="Market Value"
              col="marketValue"
              sortKey={sortKey}
              sortDir={sortDir}
              onClick={toggleSort}
              align="right"
            />
            <Th
              label="Gain/Loss $"
              col="gainLossDollar"
              sortKey={sortKey}
              sortDir={sortDir}
              onClick={toggleSort}
              align="right"
            />
            <Th
              label="Gain/Loss %"
              col="gainLossPercent"
              sortKey={sortKey}
              sortDir={sortDir}
              onClick={toggleSort}
              align="right"
            />
            <Th
              label="% Portfolio"
              col="allocationPercent"
              sortKey={sortKey}
              sortDir={sortDir}
              onClick={toggleSort}
              align="right"
            />
          </tr>
        </thead>
        <tbody>
          {sorted.map((h) => (
            <tr
              key={h.ticker}
              className="transition-colors duration-150 ease-brand hover:bg-[rgb(var(--color-grey-800))]"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <td
                style={{
                  padding: "12px",
                  color: "rgb(var(--color-orange))",
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                }}
              >
                {h.ticker}
              </td>
              <td
                className="text-text-muted"
                style={{
                  padding: "12px",
                  maxWidth: "180px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {h.name ?? "—"}
              </td>
              <Td>{fmtShares(h.shares)}</Td>
              <Td>{fmtMoney(h.avgCost)}</Td>
              <Td muted={h.priceUnavailable}>
                {h.priceUnavailable ? "—" : fmtMoney(h.currentPrice)}
              </Td>
              <Td muted={h.priceUnavailable}>
                {h.priceUnavailable ? "—" : fmtMoney(h.marketValue)}
              </Td>
              <Td
                color={
                  h.priceUnavailable
                    ? "var(--text-muted)"
                    : plColor(h.gainLossDollar)
                }
              >
                {h.priceUnavailable
                  ? "—"
                  : fmtMoney(h.gainLossDollar, true)}
              </Td>
              <Td
                color={
                  h.priceUnavailable
                    ? "var(--text-muted)"
                    : plColor(h.gainLossDollar)
                }
              >
                {h.priceUnavailable ? "—" : fmtPct(h.gainLossPercent)}
              </Td>
              <Td>{fmtPct(h.allocationPercent, false)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  label,
  col,
  sortKey,
  sortDir,
  onClick,
  align,
}: {
  label: string;
  col: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onClick: (k: SortKey) => void;
  align: "left" | "right";
}) {
  const active = col === sortKey;
  return (
    <th
      onClick={() => onClick(col)}
      className="text-text-muted uppercase cursor-pointer select-none"
      style={{
        padding: "10px 12px",
        fontSize: "10px",
        letterSpacing: "0.18em",
        fontWeight: 600,
        textAlign: align,
        whiteSpace: "nowrap",
      }}
    >
      {label}
      <span
        style={{
          marginLeft: "4px",
          color: active
            ? "rgb(var(--color-orange))"
            : "rgba(255, 255, 255, 0.18)",
        }}
      >
        {active ? (sortDir === "asc" ? "▲" : "▼") : "▾"}
      </span>
    </th>
  );
}

function Td({
  children,
  color,
  muted,
}: {
  children: React.ReactNode;
  color?: string;
  muted?: boolean;
}) {
  return (
    <td
      style={{
        padding: "12px",
        textAlign: "right",
        color: color ?? (muted ? "var(--text-muted)" : "var(--text-primary)"),
      }}
    >
      {children}
    </td>
  );
}
