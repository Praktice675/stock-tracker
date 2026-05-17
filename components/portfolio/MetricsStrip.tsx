import type { PortfolioTotals } from "@/lib/portfolio/compute";

const POSITIVE = "#00FF94";
const NEGATIVE = "#FF3B5C";

function fmtMoney(n: number, signed = false): string {
  const sign = n < 0 ? "-" : signed ? "+" : "";
  const abs = Math.abs(n);
  return (
    sign +
    "$" +
    abs.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
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

export default function MetricsStrip({ totals }: { totals: PortfolioTotals }) {
  return (
    <div
      className="grid grid-cols-4"
      style={{
        gap: "1px",
        backgroundColor: "var(--border)",
        border: "1px solid var(--border)",
      }}
    >
      <Card label="Total Value" value={fmtMoney(totals.totalValue)} />
      <Card
        label="Today's P&L"
        value={fmtMoney(totals.todayPLDollar, true)}
        sub={fmtPct(totals.todayPLPercent)}
        valueColor={plColor(totals.todayPLDollar)}
      />
      <Card
        label="Total P&L"
        value={fmtMoney(totals.totalPLDollar, true)}
        valueColor={plColor(totals.totalPLDollar)}
      />
      <Card
        label="Total Return"
        value={fmtPct(totals.totalPLPercent)}
        valueColor={plColor(totals.totalPLDollar)}
      />
    </div>
  );
}

function Card({
  label,
  value,
  sub,
  valueColor,
}: {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
}) {
  return (
    <div
      className="flex flex-col bg-bg-surface"
      style={{ padding: "16px 20px" }}
    >
      <span
        className="text-text-muted uppercase font-mono"
        style={{ fontSize: "10px", letterSpacing: "0.22em" }}
      >
        {label}
      </span>
      <span
        className="font-mono"
        style={{
          fontSize: "24px",
          fontWeight: 700,
          letterSpacing: "-0.015em",
          marginTop: "8px",
          color: valueColor ?? "var(--text-primary)",
        }}
      >
        {value}
      </span>
      {sub && (
        <span
          className="font-mono"
          style={{
            fontSize: "12px",
            letterSpacing: "-0.015em",
            marginTop: "4px",
            color: valueColor ?? "var(--text-muted)",
          }}
        >
          {sub}
        </span>
      )}
    </div>
  );
}
