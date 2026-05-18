import type { CSSProperties } from "react";

// Minimal inline sparkline. Pure SVG — no recharts overhead, no ResponsiveContainer.
// Renders nothing if there aren't at least 2 points to connect.

type Props = {
  data: number[];
  positive: boolean;
  width?: number;
  height?: number;
  className?: string;
  style?: CSSProperties;
};

const DEFAULT_WIDTH = 80;
const DEFAULT_HEIGHT = 24;

export default function Sparkline({
  data,
  positive,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  className,
  style,
}: Props) {
  if (!data || data.length < 2) return null;

  let min = Infinity;
  let max = -Infinity;
  for (const v of data) {
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;

  // Avoid divide-by-zero on a flat series.
  const range = max - min || 1;
  const xStep = width / (data.length - 1);

  const points = data
    .map((v, i) => {
      const x = i * xStep;
      // Invert: higher value sits at a smaller y.
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const stroke = positive ? "var(--accent-green)" : "var(--accent-red)";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      style={{ display: "block", flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
