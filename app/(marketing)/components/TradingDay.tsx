"use client";

import { useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger);

type Candle = {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

// 78 five-minute candles from 9:30 AM to 4:00 PM.
// Shape: open 300 → dip 297.50 @ 10:15 → peak ~304 @ noon →
// pullback 299 @ 2:00 PM → close 302.18.
const CANDLES: Candle[] = [
  { open: 300.00, high: 300.45, low: 299.70, close: 300.15, volume: 1180 }, // 0  9:30
  { open: 300.15, high: 300.20, low: 299.40, close: 299.55, volume: 1080 }, // 1  9:35
  { open: 299.55, high: 299.80, low: 298.90, close: 299.10, volume: 960 },  // 2  9:40
  { open: 299.10, high: 299.30, low: 298.50, close: 298.75, volume: 920 },  // 3  9:45
  { open: 298.75, high: 298.90, low: 298.20, close: 298.40, volume: 880 },  // 4  9:50
  { open: 298.40, high: 298.55, low: 297.95, close: 298.10, volume: 820 },  // 5  9:55
  { open: 298.10, high: 298.25, low: 297.80, close: 297.95, volume: 720 },  // 6  10:00
  { open: 297.95, high: 298.10, low: 297.65, close: 297.80, volume: 650 },  // 7  10:05
  { open: 297.80, high: 297.95, low: 297.50, close: 297.65, volume: 600 },  // 8  10:10
  { open: 297.65, high: 297.85, low: 297.40, close: 297.50, volume: 580 },  // 9  10:15 (dip)
  { open: 297.50, high: 297.95, low: 297.45, close: 297.85, volume: 560 },  // 10 10:20
  { open: 297.85, high: 298.30, low: 297.75, close: 298.20, volume: 590 },  // 11 10:25
  { open: 298.20, high: 298.65, low: 298.10, close: 298.55, volume: 620 },  // 12 10:30
  { open: 298.55, high: 299.05, low: 298.45, close: 298.95, volume: 560 },  // 13 10:35
  { open: 298.95, high: 299.40, low: 298.85, close: 299.30, volume: 540 },  // 14 10:40
  { open: 299.30, high: 299.75, low: 299.20, close: 299.65, volume: 510 },  // 15 10:45
  { open: 299.65, high: 300.15, low: 299.55, close: 300.05, volume: 540 },  // 16 10:50
  { open: 300.05, high: 300.50, low: 299.95, close: 300.40, volume: 500 },  // 17 10:55
  { open: 300.40, high: 300.90, low: 300.30, close: 300.80, volume: 480 },  // 18 11:00
  { open: 300.80, high: 301.25, low: 300.70, close: 301.15, volume: 460 },  // 19 11:05
  { open: 301.15, high: 301.60, low: 301.05, close: 301.50, volume: 440 },  // 20 11:10
  { open: 301.50, high: 301.95, low: 301.40, close: 301.85, volume: 420 },  // 21 11:15
  { open: 301.85, high: 302.30, low: 301.75, close: 302.20, volume: 400 },  // 22 11:20
  { open: 302.20, high: 302.65, low: 302.10, close: 302.55, volume: 380 },  // 23 11:25
  { open: 302.55, high: 303.00, low: 302.45, close: 302.90, volume: 320 },  // 24 11:30 (lunch begins)
  { open: 302.90, high: 303.30, low: 302.80, close: 303.20, volume: 290 },  // 25 11:35
  { open: 303.20, high: 303.55, low: 303.10, close: 303.45, volume: 260 },  // 26 11:40
  { open: 303.45, high: 303.75, low: 303.35, close: 303.65, volume: 240 },  // 27 11:45
  { open: 303.65, high: 303.90, low: 303.55, close: 303.80, volume: 230 },  // 28 11:50
  { open: 303.80, high: 304.05, low: 303.75, close: 304.00, volume: 240 },  // 29 11:55
  { open: 304.00, high: 304.15, low: 303.85, close: 303.95, volume: 260 },  // 30 12:00 (peak)
  { open: 303.95, high: 304.05, low: 303.65, close: 303.75, volume: 230 },  // 31 12:05
  { open: 303.75, high: 303.85, low: 303.45, close: 303.55, volume: 220 },  // 32 12:10
  { open: 303.55, high: 303.65, low: 303.20, close: 303.30, volume: 210 },  // 33 12:15
  { open: 303.30, high: 303.45, low: 302.95, close: 303.10, volume: 220 },  // 34 12:20
  { open: 303.10, high: 303.25, low: 302.75, close: 302.85, volume: 230 },  // 35 12:25
  { open: 302.85, high: 303.00, low: 302.55, close: 302.65, volume: 240 },  // 36 12:30
  { open: 302.65, high: 302.80, low: 302.35, close: 302.45, volume: 250 },  // 37 12:35
  { open: 302.45, high: 302.60, low: 302.15, close: 302.25, volume: 270 },  // 38 12:40
  { open: 302.25, high: 302.40, low: 301.95, close: 302.05, volume: 290 },  // 39 12:45
  { open: 302.05, high: 302.20, low: 301.75, close: 301.85, volume: 310 },  // 40 12:50
  { open: 301.85, high: 302.00, low: 301.50, close: 301.60, volume: 330 },  // 41 12:55
  { open: 301.60, high: 301.75, low: 301.30, close: 301.40, volume: 360 },  // 42 1:00 (lunch ends)
  { open: 301.40, high: 301.55, low: 301.05, close: 301.20, volume: 410 },  // 43 1:05
  { open: 301.20, high: 301.35, low: 300.80, close: 300.95, volume: 450 },  // 44 1:10
  { open: 300.95, high: 301.10, low: 300.55, close: 300.70, volume: 490 },  // 45 1:15
  { open: 300.70, high: 300.85, low: 300.30, close: 300.45, volume: 520 },  // 46 1:20
  { open: 300.45, high: 300.60, low: 300.05, close: 300.20, volume: 540 },  // 47 1:25
  { open: 300.20, high: 300.35, low: 299.85, close: 299.95, volume: 560 },  // 48 1:30
  { open: 299.95, high: 300.10, low: 299.65, close: 299.75, volume: 580 },  // 49 1:35
  { open: 299.75, high: 299.90, low: 299.50, close: 299.60, volume: 600 },  // 50 1:40
  { open: 299.60, high: 299.75, low: 299.35, close: 299.45, volume: 610 },  // 51 1:45
  { open: 299.45, high: 299.60, low: 299.20, close: 299.30, volume: 620 },  // 52 1:50
  { open: 299.30, high: 299.40, low: 299.05, close: 299.15, volume: 630 },  // 53 1:55
  { open: 299.15, high: 299.30, low: 298.85, close: 299.00, volume: 640 },  // 54 2:00 (pullback)
  { open: 299.00, high: 299.35, low: 298.90, close: 299.25, volume: 620 },  // 55 2:05
  { open: 299.25, high: 299.60, low: 299.15, close: 299.50, volume: 600 },  // 56 2:10
  { open: 299.50, high: 299.80, low: 299.40, close: 299.70, volume: 580 },  // 57 2:15
  { open: 299.70, high: 300.00, low: 299.60, close: 299.90, volume: 600 },  // 58 2:20
  { open: 299.90, high: 300.20, low: 299.80, close: 300.10, volume: 620 },  // 59 2:25
  { open: 300.10, high: 300.40, low: 300.00, close: 300.30, volume: 640 },  // 60 2:30
  { open: 300.30, high: 300.55, low: 300.20, close: 300.45, volume: 660 },  // 61 2:35
  { open: 300.45, high: 300.75, low: 300.35, close: 300.65, volume: 680 },  // 62 2:40
  { open: 300.65, high: 300.95, low: 300.55, close: 300.85, volume: 700 },  // 63 2:45
  { open: 300.85, high: 301.15, low: 300.75, close: 301.05, volume: 720 },  // 64 2:50
  { open: 301.05, high: 301.30, low: 300.95, close: 301.20, volume: 740 },  // 65 2:55
  { open: 301.20, high: 301.45, low: 301.10, close: 301.35, volume: 780 },  // 66 3:00
  { open: 301.35, high: 301.60, low: 301.25, close: 301.50, volume: 820 },  // 67 3:05
  { open: 301.50, high: 301.75, low: 301.40, close: 301.65, volume: 850 },  // 68 3:10
  { open: 301.65, high: 301.85, low: 301.55, close: 301.75, volume: 870 },  // 69 3:15
  { open: 301.75, high: 301.95, low: 301.65, close: 301.85, volume: 900 },  // 70 3:20
  { open: 301.85, high: 302.05, low: 301.70, close: 301.80, volume: 930 },  // 71 3:25
  { open: 301.80, high: 302.00, low: 301.65, close: 301.95, volume: 960 },  // 72 3:30
  { open: 301.95, high: 302.15, low: 301.85, close: 302.05, volume: 1000 }, // 73 3:35
  { open: 302.05, high: 302.20, low: 301.90, close: 302.00, volume: 1040 }, // 74 3:40
  { open: 302.00, high: 302.15, low: 301.85, close: 302.10, volume: 1080 }, // 75 3:45
  { open: 302.10, high: 302.30, low: 302.00, close: 302.25, volume: 1120 }, // 76 3:50
  { open: 302.25, high: 302.40, low: 302.10, close: 302.18, volume: 1160 }, // 77 3:55→4:00 (close)
];

const TOTAL = CANDLES.length; // 78
const TOTAL_MINUTES = 390; // 6.5 hours
const CHART_LEFT = 60;
const CHART_RIGHT = 1040;
const CHART_TOP_PAD = 20;
const CHART_PRICE_BOTTOM = 360;
const CHART_PRICE_HEIGHT = CHART_PRICE_BOTTOM - CHART_TOP_PAD; // 340
const VOL_TOP = 360;
const VOL_BOTTOM = 460;
const VOL_HEIGHT = VOL_BOTTOM - VOL_TOP;
const SVG_HEIGHT = 480;
const SVG_WIDTH = 1100;
const CANDLE_WIDTH = 8;
const CANDLE_STEP = (CHART_RIGHT - CHART_LEFT) / TOTAL;

const PRICES = CANDLES.flatMap((c) => [c.high, c.low]);
const MIN_PRICE = Math.min(...PRICES);
const MAX_PRICE = Math.max(...PRICES);
const MAX_VOL = Math.max(...CANDLES.map((c) => c.volume));

function priceToY(price: number): number {
  return (
    CHART_PRICE_BOTTOM -
    ((price - MIN_PRICE) / (MAX_PRICE - MIN_PRICE)) * CHART_PRICE_HEIGHT
  );
}

function candleX(index: number): number {
  return CHART_LEFT + index * CANDLE_STEP;
}

function formatTime(minutesFromOpen: number): string {
  const clamped = Math.max(0, Math.min(TOTAL_MINUTES, minutesFromOpen));
  const totalMin = 9 * 60 + 30 + clamped;
  const h24 = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

const Y_AXIS_LEVELS = 5;
const yAxisTicks = Array.from({ length: Y_AXIS_LEVELS }, (_, i) => {
  const t = i / (Y_AXIS_LEVELS - 1);
  return MAX_PRICE - t * (MAX_PRICE - MIN_PRICE);
});

// Every 30 minutes: candle indexes 0,6,12,...,72 + right edge at 78.
const xAxisTicks = [0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72, 78];

export default function TradingDay() {
  const sectionRef = useRef<HTMLDivElement>(null);
  // Desktop scrub starts at 0; mobile (matchMedia branch) sets it to 1.
  const [progress, setProgress] = useState(0);

  useGSAP(
    () => {
      ScrollTrigger.matchMedia({
        "(min-width: 768px)": () => {
          const trigger = ScrollTrigger.create({
            trigger: sectionRef.current,
            start: "top top",
            end: "+=180%",
            pin: true,
            scrub: 0.5,
            onUpdate: (self) => setProgress(self.progress),
          });
          return () => trigger.kill();
        },
        "(max-width: 767px)": () => {
          setProgress(1);
        },
      });
    },
    { scope: sectionRef }
  );

  const visibleCount = Math.min(TOTAL, Math.floor(progress * TOTAL));
  // While progress > 0 we want at least the first candle visible so the
  // header doesn't read a "null" candle.
  const displayCount = progress > 0 ? Math.max(1, visibleCount) : 0;
  const minutesFromOpen = Math.floor(progress * TOTAL_MINUTES);
  const currentCandle = CANDLES[Math.max(0, displayCount - 1)];
  const pctChange =
    ((currentCandle.close - CANDLES[0].open) / CANDLES[0].open) * 100;
  const isUp = currentCandle.close >= CANDLES[0].open;
  const priceColor = isUp ? "var(--green)" : "var(--red)";
  const pctSign = pctChange >= 0 ? "+" : "";

  return (
    <section
      ref={sectionRef}
      style={{
        background: "var(--bg)",
        padding: "120px 80px",
        minHeight: "100vh",
      }}
    >
      <style>{`
        @keyframes tdFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .td-candle {
          animation: tdFadeIn 200ms ease forwards;
        }
        @media (max-width: 767px) {
          .td-section { padding: 80px 20px !important; }
          .td-header-row { font-size: 22px !important; }
          .td-candle { animation: none; }
        }
      `}</style>

      <span
        className="pulse-section-label"
        style={{ display: "block", textAlign: "center" }}
      >
        ONE TRADING DAY
      </span>

      <h2
        style={{
          fontSize: "clamp(36px, 4vw, 60px)",
          fontWeight: 800,
          color: "var(--text)",
          textAlign: "center",
          maxWidth: 800,
          margin: "0 auto 60px",
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
        }}
      >
        9:30 AM to 4:00 PM. Every tick, captured.
      </h2>

      <div
        className="td-header-row"
        style={{
          maxWidth: 1100,
          margin: "0 auto 32px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          fontFamily: "var(--font-mono-landing)",
          fontSize: 32,
        }}
      >
        <div style={{ color: "var(--text)" }}>
          {formatTime(minutesFromOpen)}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ color: priceColor }}>
            ${currentCandle.close.toFixed(2)}
          </span>
          <span style={{ color: priceColor, fontSize: 18 }}>
            {pctSign}
            {pctChange.toFixed(2)}%
          </span>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          width="100%"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Single trading day candlestick chart"
        >
          {/* Y-axis gridlines + labels */}
          {yAxisTicks.map((price, i) => {
            const y = priceToY(price);
            return (
              <g key={`yt-${i}`}>
                <line
                  x1={CHART_LEFT}
                  x2={CHART_RIGHT}
                  y1={y}
                  y2={y}
                  stroke="rgba(255,255,255,0.04)"
                  strokeWidth={1}
                />
                <text
                  x={CHART_RIGHT + 10}
                  y={y + 4}
                  fill="var(--text-dim)"
                  fontFamily="var(--font-mono-landing)"
                  fontSize={11}
                >
                  ${price.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* Divider between price and volume regions */}
          <line
            x1={CHART_LEFT}
            x2={CHART_RIGHT}
            y1={VOL_TOP}
            y2={VOL_TOP}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />

          {/* Candles + volume bars (slice for perf + fade-in via @keyframes) */}
          {CANDLES.slice(0, displayCount).map((c, i) => {
            const x = candleX(i);
            const cx = x + CANDLE_WIDTH / 2;
            const openY = priceToY(c.open);
            const closeY = priceToY(c.close);
            const highY = priceToY(c.high);
            const lowY = priceToY(c.low);
            const up = c.close >= c.open;
            const color = up ? "var(--green)" : "var(--red)";
            const bodyY = Math.min(openY, closeY);
            const bodyH = Math.max(1, Math.abs(openY - closeY));
            const volH = (c.volume / MAX_VOL) * VOL_HEIGHT;
            const volY = VOL_BOTTOM - volH;
            return (
              <g key={i} className="td-candle">
                <line
                  x1={cx}
                  x2={cx}
                  y1={highY}
                  y2={lowY}
                  stroke={color}
                  strokeWidth={1}
                />
                <rect
                  x={x}
                  y={bodyY}
                  width={CANDLE_WIDTH}
                  height={bodyH}
                  fill={color}
                />
                <rect
                  x={x}
                  y={volY}
                  width={CANDLE_WIDTH}
                  height={volH}
                  fill={color}
                  opacity={0.4}
                />
              </g>
            );
          })}

          {/* X-axis labels at every 30 minutes */}
          {xAxisTicks.map((idx) => {
            const x =
              idx >= TOTAL
                ? CHART_RIGHT
                : candleX(idx) + CANDLE_WIDTH / 2;
            const label = formatTime(idx * 5).replace(" AM", "").replace(" PM", "");
            return (
              <text
                key={`xt-${idx}`}
                x={x}
                y={475}
                fill="var(--text-dim)"
                fontFamily="var(--font-mono-landing)"
                fontSize={11}
                textAnchor="middle"
              >
                {label}
              </text>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
