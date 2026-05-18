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
    <div className="indices-marquee" aria-label="Major indices">
      <div className="indices-marquee__inner">
        {INDICES.map((idx) => (
          <IndexCell
            key={idx.ticker}
            label={idx.label}
            quote={quotes[idx.ticker]}
            flashDirection={flashStates[idx.ticker] ?? null}
          />
        ))}
      </div>
    </div>
  );
}

function IndexCell({
  label,
  quote,
  flashDirection,
}: {
  label: string;
  quote: LiveQuote | null | undefined;
  flashDirection: FlashDirection | null;
}) {
  const hasQuote = !!quote;
  const positive = hasQuote && quote.changePercent >= 0;
  const flashClass =
    flashDirection === "green"
      ? "flash-green"
      : flashDirection === "red"
        ? "flash-red"
        : "";

  return (
    <div className="indices-marquee__cell">
      <span className="indices-marquee__label">{label}</span>
      <span className={`indices-marquee__value ${flashClass}`.trim()}>
        {hasQuote ? quote.price.toFixed(2) : PLACEHOLDER}
      </span>
      {hasQuote ? (
        <span
          className={`indices-marquee__change ${flashDirection ? "flash-badge" : ""}`.trim()}
          style={{
            backgroundColor: positive
              ? "rgba(0, 208, 132, 0.12)"
              : "rgba(255, 51, 85, 0.12)",
            color: positive ? "#00D084" : "#FF3355",
          }}
        >
          {positive ? "+" : ""}
          {quote.changePercent.toFixed(2)}%
        </span>
      ) : (
        <span
          className="indices-marquee__change"
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.04)",
            color: "var(--text-muted)",
          }}
        >
          {PLACEHOLDER}
        </span>
      )}
    </div>
  );
}
