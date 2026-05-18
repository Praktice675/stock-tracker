"use client";

import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  HistogramSeries,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";

type Props = {
  selectedTicker?: string;
};

type Candle = {
  // Daily candles use "YYYY-MM-DD" strings; intraday candles use unix seconds.
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const TIMEFRAMES = ["1D", "1W", "1M", "3M", "1Y"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];

const POSITIVE = "#4ade80";
const NEGATIVE = "#ef4444";

type TickerConfig = {
  seed: number;
  startPrice: number;
  min: number;
  max: number;
};

const TICKER_CONFIG: Record<string, TickerConfig> = {
  AAPL: { seed: 42, startPrice: 182, min: 170, max: 195 },
  NVDA: { seed: 11, startPrice: 855, min: 820, max: 900 },
  TSLA: { seed: 7, startPrice: 180, min: 165, max: 210 },
  MSFT: { seed: 91, startPrice: 415, min: 400, max: 430 },
  SPY: { seed: 23, startPrice: 521, min: 510, max: 530 },
  META: { seed: 59, startPrice: 528, min: 510, max: 545 },
};

function generateMockCandles(
  seed: number,
  count: number,
  startPrice: number,
  min: number,
  max: number,
): Candle[] {
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };

  const rangeSize = max - min;
  const driftScale = rangeSize * 0.13;
  const spreadBase = rangeSize * 0.03;
  const spreadJitter = rangeSize * 0.09;

  const start = new Date("2024-01-01T00:00:00Z");
  const candles: Candle[] = [];
  let prevClose = startPrice;

  for (let i = 0; i < count; i++) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + i);
    const time = date.toISOString().slice(0, 10);

    const drift = (rand() - 0.5) * driftScale;
    const open = prevClose;
    let close = open + drift;
    if (close < min) close = min + rand() * (rangeSize * 0.05);
    if (close > max) close = max - rand() * (rangeSize * 0.05);

    const spread = spreadBase + rand() * spreadJitter;
    const high = Math.max(open, close) + rand() * spread;
    const low = Math.min(open, close) - rand() * spread;

    const volume = Math.round(50_000_000 + rand() * 70_000_000);

    candles.push({ time, open, high, low, close, volume });
    prevClose = close;
  }

  return candles;
}

function generateForTicker(ticker: string): Candle[] {
  const cfg = TICKER_CONFIG[ticker] ?? TICKER_CONFIG.AAPL;
  return generateMockCandles(cfg.seed, 60, cfg.startPrice, cfg.min, cfg.max);
}

export default function StockChart({ selectedTicker = "AAPL" }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  const [activeTf, setActiveTf] = useState<Timeframe>("1M");
  const [data, setData] = useState<Candle[]>(() => generateForTicker(selectedTicker));
  const [loading, setLoading] = useState(false);
  // Header price, day-change, and the OHLCV stat columns all come from
  // /api/quote, NOT from the candles array. The candles array's last two
  // entries shift shape with the selected range (1D = minute bars, 1M/1Y =
  // daily bars), which would make these values drift when the user only
  // switches chart ranges. The quote is range-independent — always the
  // latest price + today-vs-yesterday change.
  type QuoteState = {
    price: number;
    changePercent: number;
    open: number | null;
    dayHigh: number | null;
    dayLow: number | null;
    volume: number;
    name: string | null;
    exchange: string | null;
  };
  const [quote, setQuote] = useState<QuoteState | null>(null);

  useEffect(() => {
    // Show mock immediately so the chart isn't blank during fetch
    setData(generateForTicker(selectedTicker));
    setLoading(true);

    let cancelled = false;
    fetch(`/api/candles/${selectedTicker}?timeframe=${activeTf}`, {
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) {
          console.warn(
            `Candles fetch for ${selectedTicker} (${activeTf}) returned HTTP ${res.status}; keeping mock data`,
          );
          return;
        }
        const candles: Candle[] = await res.json();
        if (cancelled) return;
        if (Array.isArray(candles) && candles.length > 0) {
          setData(candles);
        }
      })
      .catch((err) => {
        console.warn(
          `Candles fetch for ${selectedTicker} (${activeTf}) failed; keeping mock data:`,
          err instanceof Error ? err.message : err,
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedTicker, activeTf]);

  // Independent of activeTf — only refetches when the selected ticker
  // changes (then polls every 30s). Clears the prior ticker's quote first
  // so we don't briefly render AAPL's price under MSFT's header. Setting
  // setQuote here does NOT cause the chart series to re-render — the chart
  // useEffect depends on `data`, not `quote`.
  useEffect(() => {
    setQuote(null);
    let cancelled = false;

    const fetchQuote = async () => {
      try {
        const res = await fetch(`/api/quote/${selectedTicker}`, {
          cache: "no-store",
        });
        if (cancelled || !res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        if (
          typeof json?.price === "number" &&
          typeof json?.changePercent === "number"
        ) {
          setQuote({
            price: json.price,
            changePercent: json.changePercent,
            open: typeof json.open === "number" ? json.open : null,
            dayHigh: typeof json.dayHigh === "number" ? json.dayHigh : null,
            dayLow: typeof json.dayLow === "number" ? json.dayLow : null,
            volume: typeof json.volume === "number" ? json.volume : 0,
            name: typeof json.name === "string" ? json.name : null,
            exchange:
              typeof json.exchange === "string" ? json.exchange : null,
          });
        }
      } catch (err) {
        console.warn(
          `Quote fetch for ${selectedTicker} failed:`,
          err instanceof Error ? err.message : err,
        );
      }
    };

    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      void fetchQuote();
    };

    tick();
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
  }, [selectedTicker]);

  // Fall back to candle-derived values only while the quote is loading
  // for the first time — keeps the header from showing "---" on first paint.
  const last = data[data.length - 1];
  const prev = data[data.length - 2] ?? last;
  const fallbackChangePct = ((last.close - prev.close) / prev.close) * 100;
  const price = quote?.price ?? last.close;
  const changePct = quote?.changePercent ?? fallbackChangePct;
  const isPositive = changePct >= 0;
  const displayName = quote?.name ?? selectedTicker;
  const exchangeLabel = quote?.exchange
    ? `${quote.exchange}: ${selectedTicker}`
    : selectedTicker;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      layout: {
        background: { color: "rgb(12, 11, 17)" },
        textColor: "rgb(240, 239, 235)",
        fontFamily: "var(--font-mono), monospace",
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.04)" },
        horzLines: { color: "rgba(255, 255, 255, 0.04)" },
      },
      rightPriceScale: { borderColor: "rgba(255, 255, 255, 0.06)" },
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.06)",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: { mode: 0 },
      autoSize: true,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: POSITIVE,
      downColor: NEGATIVE,
      borderUpColor: POSITIVE,
      borderDownColor: NEGATIVE,
      wickUpColor: POSITIVE,
      wickDownColor: NEGATIVE,
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    const chart = chartRef.current;
    if (!candleSeries || !volumeSeries || !chart) return;

    const candleData: CandlestickData<Time>[] = data.map((c) => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const volumeData: HistogramData<Time>[] = data.map((c) => ({
      time: c.time as Time,
      value: c.volume,
      color:
        c.close >= c.open ? "rgba(74, 222, 128, 0.3)" : "rgba(239, 68, 68, 0.3)",
    }));

    candleSeries.setData(candleData);
    volumeSeries.setData(volumeData);
    chart.timeScale().fitContent();
  }, [data]);

  return (
    <div className="flex h-full w-full flex-col">
      <Toolbar
        name={displayName}
        exchangeLabel={exchangeLabel}
        price={price}
        changePct={changePct}
        isPositive={isPositive}
        open={quote?.open ?? null}
        dayHigh={quote?.dayHigh ?? null}
        dayLow={quote?.dayLow ?? null}
        volume={quote?.volume ?? 0}
        activeTf={activeTf}
        onTfChange={setActiveTf}
      />
      <div className="relative min-h-0 flex-1" style={{ width: "100%" }}>
        <div
          ref={containerRef}
          style={{ width: "100%", height: "100%" }}
        />
        {loading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "rgba(12, 11, 17, 0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <span
              className="font-mono uppercase"
              style={{
                fontSize: "11px",
                color: "var(--accent)",
                letterSpacing: "0.2em",
              }}
            >
              Loading {selectedTicker}...
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function fmtPrice(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtVolume(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return "—";
  if (v < 1000) return String(v);
  if (v < 1_000_000) return `${Math.round(v / 1000)}k`;
  if (v < 1_000_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  return `${(v / 1_000_000_000).toFixed(1)}B`;
}

function StatCol({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col" style={{ minWidth: 0 }}>
      <span
        className="font-mono uppercase"
        style={{
          fontSize: "9px",
          letterSpacing: "0.25em",
          color: "var(--text-muted)",
          marginBottom: "4px",
        }}
      >
        {label}
      </span>
      <span
        className="font-mono"
        style={{
          fontSize: "14px",
          fontWeight: 600,
          color: "var(--text-primary)",
          letterSpacing: "-0.015em",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Toolbar({
  name,
  exchangeLabel,
  price,
  changePct,
  isPositive,
  open,
  dayHigh,
  dayLow,
  volume,
  activeTf,
  onTfChange,
}: {
  name: string;
  exchangeLabel: string;
  price: number;
  changePct: number;
  isPositive: boolean;
  open: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number;
  activeTf: Timeframe;
  onTfChange: (tf: Timeframe) => void;
}) {
  const sign = isPositive ? "+" : "";
  const pillBg = isPositive
    ? "rgba(74, 222, 128, 0.12)"
    : "rgba(239, 68, 68, 0.12)";
  const pillColor = isPositive ? "var(--accent-green)" : "var(--accent-red)";

  return (
    <div className="flex shrink-0 flex-col">
      {/* Header row: name+exchange / big price+pill / OHLCV columns.
          Left side (name + price/pill) gets `flex: 1` and `flex-wrap` so
          if a long company name + the price together don't fit on one
          row, the price/pill cluster drops to a new line BELOW the name
          rather than truncating the name. Stat columns sit on the far
          right and never wrap. */}
      <div
        className="flex items-center"
        style={{ marginBottom: "20px" }}
      >
        <div
          className="flex flex-wrap items-center"
          style={{
            gap: "24px",
            flex: 1,
            minWidth: 0,
            marginRight: "32px",
          }}
        >
          <div className="flex flex-col" style={{ gap: "4px", flexShrink: 0 }}>
            <span
              style={{
                fontSize: "18px",
                fontWeight: 600,
                color: "var(--text-primary)",
                letterSpacing: "-0.015em",
                whiteSpace: "nowrap",
              }}
            >
              {name}
            </span>
            <span
              className="font-mono uppercase"
              style={{
                fontSize: "10px",
                letterSpacing: "0.2em",
                color: "var(--text-muted)",
                whiteSpace: "nowrap",
              }}
            >
              {exchangeLabel}
            </span>
          </div>

          <div
            className="flex items-center"
            style={{ gap: "12px", flexShrink: 0 }}
          >
            <span
              className="font-mono"
              style={{
                fontSize: "20px",
                fontWeight: 700,
                color: "var(--text-primary)",
                letterSpacing: "-0.015em",
              }}
            >
              ${price.toFixed(2)}
            </span>
            <span
              className="font-mono"
              style={{
                fontSize: "12px",
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: "8px",
                backgroundColor: pillBg,
                color: pillColor,
                letterSpacing: "-0.015em",
              }}
            >
              {sign}
              {changePct.toFixed(2)}%
            </span>
          </div>
        </div>

        <div
          className="flex items-center"
          style={{ gap: "32px", flexShrink: 0 }}
        >
          <StatCol label="Open" value={fmtPrice(open)} />
          <StatCol label="High" value={fmtPrice(dayHigh)} />
          <StatCol label="Low" value={fmtPrice(dayLow)} />
          <StatCol label="Volume" value={fmtVolume(volume)} />
        </div>
      </div>

      {/* Period pills — segmented control, centered above the chart */}
      <div
        className="flex"
        style={{ marginBottom: "16px", justifyContent: "center" }}
      >
        <div
          className="flex"
          style={{
            width: "fit-content",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "10px",
            padding: "4px",
            gap: "2px",
          }}
        >
          {TIMEFRAMES.map((tf) => {
            const active = tf === activeTf;
            return (
              <button
                key={tf}
                type="button"
                onClick={() => onTfChange(tf)}
                className={`font-mono uppercase ease-brand ${
                  active ? "" : "hover:text-text-primary"
                }`}
                style={{
                  padding: "6px 14px",
                  borderRadius: "8px",
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.15em",
                  background: active ? "var(--bg-surface)" : "transparent",
                  color: active ? "var(--text-primary)" : "var(--text-muted)",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 150ms",
                }}
              >
                {tf}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
