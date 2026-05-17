"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  addTransaction,
  computePositions,
  deletePositionByTicker,
  getTransactions,
  type Position as DbPosition,
} from "@/lib/db/portfolio";

type EnrichedPosition = {
  ticker: string;
  name: string;
  shares: number;
  avgCost: number;
  currentPrice: number | null;
  currentValue: number | null;
  gainLoss: number | null;
  gainLossPercent: number | null;
};

const POSITIVE = "#00FF94";
const NEGATIVE = "#FF3B5C";
const PLACEHOLDER = "—";

function formatMoney(n: number): string {
  const sign = n < 0 ? "-" : "";
  return (
    sign +
    "$" +
    Math.abs(n).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function formatSignedMoney(n: number): string {
  if (n === 0) return "$0.00";
  const sign = n < 0 ? "-" : "+";
  return (
    sign +
    "$" +
    Math.abs(n).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

type Props = {
  selectedTicker: string;
  onSelect: (ticker: string) => void;
  user: User | null;
  authLoaded: boolean;
};

export default function PortfolioTracker({
  selectedTicker,
  onSelect,
  user,
  authLoaded,
}: Props) {
  const [positions, setPositions] = useState<DbPosition[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [quotes, setQuotes] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  const [tickerInput, setTickerInput] = useState("");
  const [sharesInput, setSharesInput] = useState("");
  const [avgCostInput, setAvgCostInput] = useState("");

  const cancelledRef = useRef(false);
  const positionsRef = useRef(positions);
  positionsRef.current = positions;

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const txs = await getTransactions();
      const pos = computePositions(txs);
      setPositions(pos);
    } catch (err) {
      console.warn("Failed to load transactions:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial load + reload when user changes (sign in / out).
  useEffect(() => {
    if (!authLoaded) return;
    if (!user) {
      setPositions([]);
      return;
    }
    refresh();
  }, [authLoaded, user, refresh]);

  // Fetch every position's quote in parallel
  const fetchAllQuotes = useCallback(async () => {
    const list = positionsRef.current;
    if (list.length === 0) return;
    const results = await Promise.all(
      list.map(async (p) => {
        try {
          const res = await fetch(`/api/quote/${p.ticker}`, {
            cache: "no-store",
          });
          if (!res.ok) return [p.ticker, null] as const;
          const json = await res.json();
          if (json?.error || typeof json?.price !== "number") {
            return [p.ticker, null] as const;
          }
          return [p.ticker, json.price as number] as const;
        } catch {
          return [p.ticker, null] as const;
        }
      }),
    );
    if (cancelledRef.current) return;
    setQuotes((prev) => {
      const next = { ...prev };
      for (const [ticker, price] of results) {
        if (price !== null) next[ticker] = price;
      }
      return next;
    });
  }, []);

  // Initial fetch + 60s poll (logged-in only)
  useEffect(() => {
    if (!user) return;
    cancelledRef.current = false;
    fetchAllQuotes();
    const id = setInterval(fetchAllQuotes, 60_000);
    return () => {
      cancelledRef.current = true;
      clearInterval(id);
    };
  }, [user, fetchAllQuotes]);

  // When a new ticker appears, fetch its quote + name immediately.
  const fetchedQuoteRef = useRef<Set<string>>(new Set());
  const fetchedNameRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const p of positions) {
      if (!fetchedQuoteRef.current.has(p.ticker)) {
        fetchedQuoteRef.current.add(p.ticker);
        fetch(`/api/quote/${p.ticker}`, { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .then((json) => {
            if (json && typeof json.price === "number") {
              setQuotes((prev) => ({ ...prev, [p.ticker]: json.price }));
            }
          })
          .catch(() => {});
      }

      if (!fetchedNameRef.current.has(p.ticker) && !names[p.ticker]) {
        fetchedNameRef.current.add(p.ticker);
        fetch(`/api/search?q=${encodeURIComponent(p.ticker)}`)
          .then((r) => (r.ok ? r.json() : []))
          .then((results) => {
            if (!Array.isArray(results)) return;
            const exact = results.find(
              (r: { ticker?: string }) => r.ticker === p.ticker,
            );
            const match = exact || results[0];
            if (!match?.name) return;
            setNames((prev) => ({ ...prev, [p.ticker]: match.name }));
          })
          .catch(() => {});
      }
    }
  }, [positions, names]);

  // Enrich positions with name + live values
  const enriched: EnrichedPosition[] = positions.map((p) => {
    const currentPrice = quotes[p.ticker] ?? null;
    const currentValue =
      currentPrice != null ? currentPrice * p.shares : null;
    const costBasis = p.avg_cost * p.shares;
    const gainLoss = currentValue != null ? currentValue - costBasis : null;
    const gainLossPercent =
      currentPrice != null && p.avg_cost > 0
        ? ((currentPrice - p.avg_cost) / p.avg_cost) * 100
        : null;
    return {
      ticker: p.ticker,
      name: names[p.ticker] ?? p.ticker,
      shares: p.shares,
      avgCost: p.avg_cost,
      currentPrice,
      currentValue,
      gainLoss,
      gainLossPercent,
    };
  });

  const totalValue = enriched.reduce(
    (acc, p) => acc + (p.currentValue ?? 0),
    0,
  );
  const totalGainLoss = enriched.reduce(
    (acc, p) => acc + (p.gainLoss ?? 0),
    0,
  );
  const hasAnyQuotes = enriched.some((p) => p.currentPrice !== null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const ticker = tickerInput.trim().toUpperCase();
    const shares = parseFloat(sharesInput);
    const avgCost = parseFloat(avgCostInput);

    if (
      !ticker ||
      !Number.isFinite(shares) ||
      shares <= 0 ||
      !Number.isFinite(avgCost) ||
      avgCost <= 0
    ) {
      return;
    }

    setTickerInput("");
    setSharesInput("");
    setAvgCostInput("");

    try {
      // Submitting "I own N shares at $X avg cost" is recorded as a single
      // buy transaction. Future per-transaction UI can preserve full history.
      await addTransaction(ticker, "buy", shares, avgCost);
      await refresh();
    } catch (err) {
      console.warn("Failed to record transaction:", err);
    }
  };

  const handleRemove = async (ticker: string) => {
    if (!user) return;
    // Optimistic remove for snappy UX
    setPositions((prev) => prev.filter((p) => p.ticker !== ticker));
    try {
      await deletePositionByTicker(ticker);
      await refresh();
    } catch (err) {
      console.warn("Failed to delete position:", err);
      // Reload truth from DB on failure
      await refresh();
    }
  };

  // Logged-out gate: don't render the form/positions, just prompt to sign in.
  if (authLoaded && !user) {
    return <SignInPrompt />;
  }

  return (
    <div className="flex h-full flex-col">
      <PositionForm
        tickerInput={tickerInput}
        sharesInput={sharesInput}
        avgCostInput={avgCostInput}
        onTickerChange={setTickerInput}
        onSharesChange={setSharesInput}
        onAvgCostChange={setAvgCostInput}
        onSubmit={handleSubmit}
      />
      <PortfolioSummary
        totalValue={totalValue}
        totalGainLoss={totalGainLoss}
        hasQuotes={hasAnyQuotes}
        hasPositions={positions.length > 0}
      />
      <div
        className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        {positions.length === 0 ? (
          <EmptyState loading={loading && !authLoaded ? false : loading} />
        ) : (
          enriched.map((p) => (
            <PositionCard
              key={p.ticker}
              position={p}
              totalValue={totalValue}
              selected={p.ticker === selectedTicker}
              onSelect={() => onSelect(p.ticker)}
              onRemove={() => handleRemove(p.ticker)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ------------------ Logged-out prompt ------------------

function SignInPrompt() {
  return (
    <div className="flex h-full items-center justify-center">
      <p
        className="text-text-muted"
        style={{
          fontSize: "11px",
          letterSpacing: "-0.015em",
          padding: "0 24px",
          textAlign: "center",
        }}
      >
        Sign in to track your portfolio.
      </p>
    </div>
  );
}

// ------------------ Form ------------------

const INPUT_BASE: React.CSSProperties = {
  height: "32px",
  padding: "6px 8px",
  backgroundColor: "rgb(var(--color-grey-800))",
  border: "none",
  borderRadius: "var(--border-radius)",
  fontFamily: "var(--font-mono), monospace",
  fontSize: "11px",
  letterSpacing: "-0.015em",
  color: "var(--text-primary)",
  outline: "none",
};

function PositionForm({
  tickerInput,
  sharesInput,
  avgCostInput,
  onTickerChange,
  onSharesChange,
  onAvgCostChange,
  onSubmit,
}: {
  tickerInput: string;
  sharesInput: string;
  avgCostInput: string;
  onTickerChange: (v: string) => void;
  onSharesChange: (v: string) => void;
  onAvgCostChange: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
}) {
  return (
    <form
      onSubmit={onSubmit}
      style={{ padding: "12px", borderBottom: "1px solid var(--border)" }}
    >
      <FormField label="Ticker">
        <input
          type="text"
          value={tickerInput}
          onChange={(e) => onTickerChange(e.target.value.toUpperCase())}
          placeholder="AAPL"
          autoComplete="off"
          spellCheck={false}
          maxLength={10}
          style={{ ...INPUT_BASE, width: "100%", height: "34px", textTransform: "uppercase" }}
        />
      </FormField>
      <FormField label="Shares">
        <input
          type="number"
          inputMode="decimal"
          value={sharesInput}
          onChange={(e) => onSharesChange(e.target.value)}
          placeholder="10"
          min="0"
          step="any"
          style={{ ...INPUT_BASE, width: "100%", height: "34px" }}
        />
      </FormField>
      <FormField label="Avg Cost">
        <input
          type="number"
          inputMode="decimal"
          value={avgCostInput}
          onChange={(e) => onAvgCostChange(e.target.value)}
          placeholder="150.00"
          min="0"
          step="any"
          style={{ ...INPUT_BASE, width: "100%", height: "34px" }}
        />
      </FormField>
      <button
        type="submit"
        style={{
          width: "100%",
          height: "36px",
          marginTop: "4px",
          backgroundColor: "rgb(var(--color-orange))",
          color: "rgb(var(--color-black))",
          border: "none",
          borderRadius: "var(--border-radius)",
          fontFamily: "var(--font-mono), monospace",
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          cursor: "pointer",
        }}
      >
        Add
      </button>
    </form>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: "6px" }}>
      <div
        className="text-text-muted uppercase"
        style={{
          fontSize: "9px",
          letterSpacing: "0.15em",
          marginBottom: "3px",
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

// ------------------ Summary ------------------

function PortfolioSummary({
  totalValue,
  totalGainLoss,
  hasQuotes,
  hasPositions,
}: {
  totalValue: number;
  totalGainLoss: number;
  hasQuotes: boolean;
  hasPositions: boolean;
}) {
  const showValues = hasPositions && hasQuotes;
  const plColor =
    !showValues
      ? "var(--text-primary)"
      : totalGainLoss > 0
        ? POSITIVE
        : totalGainLoss < 0
          ? NEGATIVE
          : "var(--text-primary)";

  return (
    <section
      style={{ padding: "12px", borderBottom: "1px solid var(--border)" }}
    >
      <div className="grid grid-cols-3 gap-2">
        <SummaryCell
          label="Total Value"
          value={showValues ? formatMoney(totalValue) : PLACEHOLDER}
        />
        <SummaryCell
          label="Total P&L"
          value={showValues ? formatSignedMoney(totalGainLoss) : PLACEHOLDER}
          valueColor={plColor}
        />
        <SummaryCell label="Today" value={PLACEHOLDER} />
      </div>
    </section>
  );
}

function SummaryCell({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="flex flex-col">
      <span
        className="text-text-muted uppercase"
        style={{ fontSize: "9px", letterSpacing: "0.15em" }}
      >
        {label}
      </span>
      <span
        className="font-mono"
        style={{
          fontSize: "13px",
          fontWeight: 700,
          letterSpacing: "-0.015em",
          marginTop: "4px",
          color: valueColor ?? "var(--text-primary)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ------------------ Empty state ------------------

function EmptyState({ loading }: { loading: boolean }) {
  return (
    <div className="flex h-full items-center justify-center">
      <p
        className="text-text-muted"
        style={{
          fontSize: "11px",
          letterSpacing: "-0.015em",
          padding: "0 24px",
          textAlign: "center",
        }}
      >
        {loading ? "Loading…" : "Add your first position above"}
      </p>
    </div>
  );
}

// ------------------ Position card ------------------

function PositionCard({
  position,
  totalValue,
  selected,
  onSelect,
  onRemove,
}: {
  position: EnrichedPosition;
  totalValue: number;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const hasPrice = position.currentPrice !== null;
  const gainPositive = (position.gainLoss ?? 0) >= 0;
  const gainColor = gainPositive ? POSITIVE : NEGATIVE;
  const pctOfPortfolio =
    totalValue > 0 && position.currentValue !== null
      ? Math.min(100, (position.currentValue / totalValue) * 100)
      : 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`group relative cursor-pointer transition-colors duration-150 ease-brand ${
        selected ? "" : "hover:bg-[rgb(var(--color-grey-800))]"
      }`}
      style={{
        padding: "12px",
        borderBottom: "1px solid var(--border)",
        borderLeft: selected
          ? "2px solid rgb(var(--color-orange))"
          : "2px solid transparent",
        backgroundColor: selected ? "rgb(var(--color-grey-700))" : undefined,
      }}
    >
      <button
        type="button"
        aria-label={`Remove ${position.ticker} position`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove();
        }}
        className="opacity-0 transition-opacity duration-150 ease-brand group-hover:opacity-100"
        style={{
          position: "absolute",
          top: "8px",
          right: "8px",
          width: "16px",
          height: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          background: "transparent",
          color: "var(--text-muted)",
          fontSize: "14px",
          lineHeight: 1,
          cursor: "pointer",
          padding: 0,
        }}
      >
        ×
      </button>

      {/* Top row: ticker (× sits absolute on hover) */}
      <span
        className="font-mono font-bold block"
        style={{
          fontSize: "12px",
          color: "rgb(var(--color-orange))",
          letterSpacing: "-0.015em",
        }}
      >
        {position.ticker}
      </span>
      <span
        className="text-text-muted block"
        style={{
          fontSize: "10px",
          letterSpacing: "-0.015em",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: "200px",
          marginBottom: "10px",
        }}
      >
        {position.name}
      </span>

      {/* Stats row: 3 equal columns */}
      <div
        className="grid grid-cols-3"
        style={{ gap: "8px", marginBottom: "10px" }}
      >
        <Stat label="Shares" value={String(position.shares)} />
        <Stat label="Avg Cost" value={`$${position.avgCost.toFixed(2)}`} />
        <Stat
          label="Current"
          value={hasPrice ? `$${position.currentPrice!.toFixed(2)}` : PLACEHOLDER}
        />
      </div>

      {/* Bottom row: right-aligned totals */}
      <div
        className="flex flex-col items-end"
        style={{ gap: "3px" }}
      >
        <span
          className="font-mono text-text-primary"
          style={{
            fontSize: "14px",
            fontWeight: 700,
            letterSpacing: "-0.015em",
          }}
        >
          {position.currentValue != null
            ? formatMoney(position.currentValue)
            : PLACEHOLDER}
        </span>
        <span
          className="font-mono"
          style={{
            fontSize: "12px",
            letterSpacing: "-0.015em",
            color: hasPrice ? gainColor : "var(--text-muted)",
          }}
        >
          {position.gainLoss != null
            ? formatSignedMoney(position.gainLoss)
            : PLACEHOLDER}
        </span>
        <span
          className="font-mono font-medium"
          style={{
            fontSize: "10px",
            padding: "2px 6px",
            borderRadius: "var(--border-radius)",
            backgroundColor: hasPrice
              ? `${gainColor}26`
              : "rgb(var(--color-grey-800))",
            color: hasPrice ? gainColor : "var(--text-muted)",
            letterSpacing: "-0.015em",
          }}
        >
          {position.gainLossPercent != null
            ? `${gainPositive ? "+" : ""}${position.gainLossPercent.toFixed(2)}%`
            : PLACEHOLDER}
        </span>
      </div>

      {/* Allocation bar */}
      <div
        style={{
          height: "2px",
          marginTop: "10px",
          backgroundColor: "rgb(var(--color-grey-800))",
          borderRadius: "var(--border-radius)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pctOfPortfolio}%`,
            height: "100%",
            backgroundColor: "rgb(var(--color-orange))",
            transition: "width 200ms var(--ease)",
          }}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span
        className="text-text-muted uppercase"
        style={{ fontSize: "9px", letterSpacing: "0.15em" }}
      >
        {label}
      </span>
      <span
        className="font-mono text-text-primary"
        style={{
          fontSize: "11px",
          letterSpacing: "-0.015em",
          marginTop: "2px",
        }}
      >
        {value}
      </span>
    </div>
  );
}
