"use client";

import { useEffect, useRef, useState } from "react";

type LiveQuote = {
  price: number;
  change: number;
  changePercent: number;
};

type FlashDirection = "green" | "red";

const INDICES: { ticker: string; label: string }[] = [
  { ticker: "SPY", label: "S&P 500" },
  { ticker: "QQQ", label: "NASDAQ" },
  { ticker: "DIA", label: "DOW" },
  { ticker: "VIX", label: "VIX" },
];

const PLACEHOLDER = "—";

export default function IndicesStrip() {
  const [quotes, setQuotes] = useState<Record<string, LiveQuote | null>>({});
  const [flashStates, setFlashStates] = useState<
    Record<string, FlashDirection | null>
  >({});
  const prevPrices = useRef<Record<string, number>>({});
  const flashTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );

  useEffect(() => {
    let cancelled = false;

    const triggerFlash = (ticker: string, direction: FlashDirection) => {
      const pending = flashTimeoutsRef.current[ticker];
      if (pending) clearTimeout(pending);
      setFlashStates((s) => ({ ...s, [ticker]: direction }));
      flashTimeoutsRef.current[ticker] = setTimeout(() => {
        setFlashStates((s) => ({ ...s, [ticker]: null }));
        delete flashTimeoutsRef.current[ticker];
      }, 700);
    };

    const fetchAll = async () => {
      const results = await Promise.all(
        INDICES.map(async (i) => {
          try {
            const res = await fetch(`/api/quote/${i.ticker}`, {
              cache: "no-store",
            });
            if (!res.ok) return [i.ticker, null] as const;
            const json = await res.json();
            if (json?.error || typeof json?.price !== "number") {
              return [i.ticker, null] as const;
            }
            return [
              i.ticker,
              {
                price: json.price,
                change: json.change,
                changePercent: json.changePercent,
              } as LiveQuote,
            ] as const;
          } catch {
            return [i.ticker, null] as const;
          }
        }),
      );
      if (cancelled) return;

      for (const [ticker, q] of results) {
        if (!q) continue;
        const prev = prevPrices.current[ticker];
        // First-load values don't flash
        if (prev !== undefined && q.price !== prev) {
          triggerFlash(ticker, q.price > prev ? "green" : "red");
        }
        prevPrices.current[ticker] = q.price;
      }

      setQuotes((prev) => {
        const next: Record<string, LiveQuote | null> = { ...prev };
        for (const [ticker, q] of results) next[ticker] = q;
        return next;
      });
    };

    fetchAll();
    const id = setInterval(fetchAll, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
      for (const tid of Object.values(flashTimeoutsRef.current)) {
        clearTimeout(tid);
      }
      flashTimeoutsRef.current = {};
    };
  }, []);

  return (
    <div className="flex items-center">
      {INDICES.map((idx, i) => (
        <IndexCell
          key={idx.ticker}
          label={idx.label}
          quote={quotes[idx.ticker]}
          flashDirection={flashStates[idx.ticker] ?? null}
          isFirst={i === 0}
        />
      ))}
    </div>
  );
}

function IndexCell({
  label,
  quote,
  flashDirection,
  isFirst,
}: {
  label: string;
  quote: LiveQuote | null | undefined;
  flashDirection: FlashDirection | null;
  isFirst: boolean;
}) {
  const hasQuote = !!quote;
  const flashClass =
    flashDirection === "green"
      ? "flash-green"
      : flashDirection === "red"
        ? "flash-red"
        : "";

  return (
    <div
      className="flex items-center"
      style={{
        padding: "0 14px",
        gap: "8px",
        borderLeft: isFirst ? "none" : "1px solid rgba(0, 0, 0, 0.15)",
      }}
    >
      <span
        className="font-bold uppercase"
        style={{
          fontSize: "10px",
          color: "rgb(var(--color-black))",
          letterSpacing: "0.12em",
        }}
      >
        {label}
      </span>

      <span
        className={`font-mono ${flashClass}`}
        style={{
          fontSize: "11px",
          color: "rgb(var(--color-black))",
          letterSpacing: "-0.015em",
          padding: "0 2px",
          display: "inline-block",
        }}
      >
        {hasQuote ? quote.price.toFixed(2) : PLACEHOLDER}
      </span>

      {hasQuote ? (
        <ChangeBadge
          changePercent={quote.changePercent}
          flashing={!!flashDirection}
        />
      ) : (
        <span
          className="font-mono"
          style={{
            fontSize: "10px",
            padding: "2px 6px",
            borderRadius: "var(--border-radius)",
            backgroundColor: "rgba(0, 0, 0, 0.2)",
            color: "rgb(var(--color-black))",
            letterSpacing: "-0.015em",
          }}
        >
          {PLACEHOLDER}
        </span>
      )}
    </div>
  );
}

function ChangeBadge({
  changePercent,
  flashing,
}: {
  changePercent: number;
  flashing: boolean;
}) {
  const positive = changePercent >= 0;
  const sign = positive ? "+" : "";
  return (
    <span
      className={`font-mono ${flashing ? "flash-badge" : ""}`}
      style={{
        fontSize: "10px",
        padding: "2px 6px",
        borderRadius: "var(--border-radius)",
        backgroundColor: positive
          ? "rgba(255, 255, 255, 0.25)"
          : "rgba(0, 0, 0, 0.2)",
        color: "rgb(var(--color-black))",
        letterSpacing: "-0.015em",
      }}
    >
      {sign}
      {changePercent.toFixed(2)}%
    </span>
  );
}
