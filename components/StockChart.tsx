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
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const TIMEFRAMES = ["1D", "1W", "1M", "3M", "1Y"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];

const POSITIVE = "#00FF94";
const NEGATIVE = "#FF3B5C";

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

  useEffect(() => {
    // Show mock immediately so the chart isn't blank during fetch
    setData(generateForTicker(selectedTicker));
    setLoading(true);

    let cancelled = false;
    fetch(`/api/candles/${selectedTicker}`)
      .then(async (res) => {
        if (!res.ok) {
          console.warn(
            `Candles fetch for ${selectedTicker} returned HTTP ${res.status}; keeping mock data`,
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
          `Candles fetch for ${selectedTicker} failed; keeping mock data:`,
          err instanceof Error ? err.message : err,
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedTicker]);

  const last = data[data.length - 1];
  const prev = data[data.length - 2] ?? last;
  const changePct = ((last.close - prev.close) / prev.close) * 100;
  const isPositive = changePct >= 0;

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
        timeVisible: false,
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
        c.close >= c.open ? "rgba(0, 255, 148, 0.3)" : "rgba(255, 59, 92, 0.3)",
    }));

    candleSeries.setData(candleData);
    volumeSeries.setData(volumeData);
    chart.timeScale().fitContent();
  }, [data]);

  return (
    <div className="flex h-full w-full flex-col">
      <Toolbar
        ticker={selectedTicker}
        price={last.close}
        changePct={changePct}
        isPositive={isPositive}
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
                color: "rgb(var(--color-orange))",
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

function Toolbar({
  ticker,
  price,
  changePct,
  isPositive,
  activeTf,
  onTfChange,
}: {
  ticker: string;
  price: number;
  changePct: number;
  isPositive: boolean;
  activeTf: Timeframe;
  onTfChange: (tf: Timeframe) => void;
}) {
  const color = isPositive ? POSITIVE : NEGATIVE;
  const sign = isPositive ? "+" : "";

  return (
    <div
      className="flex shrink-0 items-center justify-between px-4"
      style={{ height: "48px", borderBottom: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-3">
        <span
          className="font-mono font-bold"
          style={{
            fontSize: "16px",
            color: "var(--accent)",
            letterSpacing: "-0.015em",
          }}
        >
          {ticker}
        </span>
        <span
          className="font-mono text-text-primary"
          style={{ fontSize: "14px", letterSpacing: "-0.015em" }}
        >
          {price.toFixed(2)}
        </span>
        <span
          className="font-mono font-medium"
          style={{
            fontSize: "10px",
            padding: "2px 6px",
            borderRadius: "var(--border-radius)",
            backgroundColor: `${color}26`,
            color,
            letterSpacing: "-0.015em",
          }}
        >
          {sign}
          {changePct.toFixed(2)}%
        </span>
      </div>

      <div className="flex items-center gap-1">
        {TIMEFRAMES.map((tf) => {
          const active = tf === activeTf;
          return (
            <button
              key={tf}
              type="button"
              onClick={() => onTfChange(tf)}
              className={`font-mono uppercase transition-colors duration-150 ease-brand ${
                active ? "" : "text-text-muted hover:text-text-primary"
              }`}
              style={{
                fontSize: "10px",
                padding: "6px 8px",
                letterSpacing: "0.1em",
                color: active ? "rgb(var(--color-orange))" : undefined,
                borderBottom: active
                  ? "2px solid rgb(var(--color-orange))"
                  : "2px solid transparent",
                background: "transparent",
              }}
            >
              {tf}
            </button>
          );
        })}
      </div>
    </div>
  );
}
