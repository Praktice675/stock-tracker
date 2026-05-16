"use client";

import { useEffect, useState } from "react";
import { Line, LineChart, ResponsiveContainer } from "recharts";

type LiveQuote = {
  price: number;
  change: number;
  changePercent: number;
};

type Stock = {
  ticker: string;
  name: string;
  price: number;
  change: number;
  spark: number[];
};

const mockStocks: Stock[] = [
  { ticker: "AAPL", name: "Apple Inc.", price: 189.43, change: 1.24,
    spark: [182, 184, 183, 186, 185, 188, 189] },
  { ticker: "NVDA", name: "NVIDIA Corp.", price: 875.20, change: 3.81,
    spark: [820, 835, 842, 858, 861, 870, 875] },
  { ticker: "TSLA", name: "Tesla Inc.", price: 177.58, change: -2.14,
    spark: [195, 190, 188, 185, 183, 179, 177] },
  { ticker: "MSFT", name: "Microsoft", price: 415.32, change: 0.67,
    spark: [409, 410, 411, 412, 413, 414, 415] },
  { ticker: "SPY", name: "S&P 500 ETF", price: 521.88, change: 0.43,
    spark: [515, 516, 518, 519, 520, 521, 521] },
  { ticker: "META", name: "Meta Platforms", price: 528.40, change: -0.92,
    spark: [540, 537, 535, 532, 530, 529, 528] },
];

const POSITIVE = "#00FF94";
const NEGATIVE = "#FF3B5C";

type WatchlistProps = {
  selectedTicker: string;
  onSelect: (ticker: string) => void;
};

export default function Watchlist({ selectedTicker, onSelect }: WatchlistProps) {
  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchAll = async () => {
      const results = await Promise.all(
        mockStocks.map(async (s) => {
          try {
            const res = await fetch(`/api/quote/${s.ticker}`);
            if (!res.ok) return [s.ticker, null] as const;
            const json = await res.json();
            if (json?.error || typeof json?.price !== "number") {
              return [s.ticker, null] as const;
            }
            return [
              s.ticker,
              {
                price: json.price,
                change: json.change,
                changePercent: json.changePercent,
              } as LiveQuote,
            ] as const;
          } catch {
            return [s.ticker, null] as const;
          }
        }),
      );
      if (cancelled) return;

      setQuotes((prev) => {
        const next = { ...prev };
        for (const [ticker, q] of results) {
          if (q) next[ticker] = q;
        }
        return next;
      });
      setLoaded(true);
    };

    fetchAll();
    const id = setInterval(fetchAll, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="flex h-full flex-col">
      <input
        type="text"
        placeholder="Search ticker..."
        className="outline-none placeholder:text-text-muted"
        style={{
          display: "block",
          width: "calc(100% - 24px)",
          height: "36px",
          margin: "12px",
          padding: "0 12px",
          backgroundColor: "rgb(var(--color-grey-800))",
          borderRadius: "var(--border-radius)",
          border: "none",
          fontFamily: "var(--font-mono), monospace",
          fontSize: "12px",
          letterSpacing: "-0.015em",
          color: "var(--text-primary)",
        }}
      />

      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
        {mockStocks.map((stock) => (
          <StockCard
            key={stock.ticker}
            stock={stock}
            quote={quotes[stock.ticker]}
            loaded={loaded}
            selected={stock.ticker === selectedTicker}
            onSelect={() => onSelect(stock.ticker)}
          />
        ))}
      </div>
    </div>
  );
}

function StockCard({
  stock,
  quote,
  loaded,
  selected,
  onSelect,
}: {
  stock: Stock;
  quote: LiveQuote | undefined;
  loaded: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const hasLive = !!quote;
  const showPlaceholder = !loaded || !hasLive;

  const changePercent = hasLive ? quote.changePercent : stock.change;
  const isPositive = changePercent >= 0;
  const color = isPositive ? POSITIVE : NEGATIVE;
  const sign = isPositive ? "+" : "";
  const data = stock.spark.map((value, i) => ({ i, value }));

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
      className={`cursor-pointer transition-colors duration-150 ease-brand ${
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
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <span
            className="font-mono font-bold uppercase text-text-primary"
            style={{ fontSize: "13px", letterSpacing: "-0.015em" }}
          >
            {stock.ticker}
          </span>
          <span
            className="text-text-muted"
            style={{ fontSize: "10px", letterSpacing: "-0.015em" }}
          >
            {stock.name}
          </span>
        </div>

        <div className="flex flex-col items-end gap-1">
          <span
            className="font-mono text-text-primary"
            style={{ fontSize: "13px", letterSpacing: "-0.015em" }}
          >
            {showPlaceholder ? "---" : quote!.price.toFixed(2)}
          </span>
          <span
            className="font-mono font-medium"
            style={{
              fontSize: "10px",
              padding: "2px 6px",
              borderRadius: "var(--border-radius)",
              backgroundColor: showPlaceholder
                ? "rgb(var(--color-grey-800))"
                : `${color}26`,
              color: showPlaceholder ? "var(--text-muted)" : color,
              letterSpacing: "-0.015em",
            }}
          >
            {showPlaceholder ? "---" : `${sign}${changePercent.toFixed(2)}%`}
          </span>
        </div>
      </div>

      <div style={{ height: "28px", margin: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
