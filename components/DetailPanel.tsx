"use client";

import { useEffect, useState } from "react";

type Stat = { label: string; value: string };
type Rating = { label: string; pct: number; color: string };
type NewsItem = { headline: string; source: string; time: string };

type TickerData = {
  name: string;
  sector: string;
  exchange: string;
  stats: Stat[];
  range: { low: number; current: number; high: number };
  ratings: Rating[];
  news: NewsItem[];
};

const MUTED_BAR = "rgb(var(--color-grey-300))";

const TICKER_DATA: Record<string, TickerData> = {
  AAPL: {
    name: "Apple Inc.",
    sector: "Technology",
    exchange: "NASDAQ",
    stats: [
      { label: "Market Cap", value: "$2.94T" },
      { label: "P/E Ratio", value: "29.4x" },
      { label: "EPS", value: "$6.43" },
      { label: "Revenue", value: "$383.9B" },
      { label: "52W High", value: "$199.62" },
      { label: "52W Low", value: "$164.08" },
      { label: "Avg Volume", value: "58.3M" },
      { label: "Beta", value: "1.24" },
      { label: "Div Yield", value: "0.52%" },
      { label: "Float", value: "15.4B" },
    ],
    range: { low: 164.08, current: 171.39, high: 199.62 },
    ratings: [
      { label: "Buy", pct: 68, color: "#00FF94" },
      { label: "Hold", pct: 24, color: MUTED_BAR },
      { label: "Sell", pct: 8, color: "#FF3B5C" },
    ],
    news: [
      {
        headline:
          "Apple announces record Q4 earnings, beats analyst expectations on services revenue growth",
        source: "Reuters",
        time: "2h ago",
      },
      {
        headline:
          "iPhone 16 demand reportedly stronger than prior cycle as AI features roll out globally",
        source: "Bloomberg",
        time: "5h ago",
      },
      {
        headline:
          "Apple expands India manufacturing footprint with new Foxconn facility in Karnataka",
        source: "WSJ",
        time: "9h ago",
      },
    ],
  },

  NVDA: {
    name: "NVIDIA Corp.",
    sector: "Semiconductors",
    exchange: "NASDAQ",
    stats: [
      { label: "Market Cap", value: "$2.18T" },
      { label: "P/E Ratio", value: "68.2x" },
      { label: "EPS", value: "$12.87" },
      { label: "Revenue", value: "$60.9B" },
      { label: "52W High", value: "$974.00" },
      { label: "52W Low", value: "$370.40" },
      { label: "Avg Volume", value: "49.5M" },
      { label: "Beta", value: "1.68" },
      { label: "Div Yield", value: "0.03%" },
      { label: "Float", value: "2.4B" },
    ],
    range: { low: 370.4, current: 855.0, high: 974.0 },
    ratings: [
      { label: "Buy", pct: 82, color: "#00FF94" },
      { label: "Hold", pct: 14, color: MUTED_BAR },
      { label: "Sell", pct: 4, color: "#FF3B5C" },
    ],
    news: [
      {
        headline:
          "NVIDIA Blackwell shipments accelerate as hyperscalers expand AI training capacity",
        source: "Bloomberg",
        time: "1h ago",
      },
      {
        headline:
          "Analysts raise NVDA price targets following stronger-than-expected datacenter guidance",
        source: "CNBC",
        time: "4h ago",
      },
      {
        headline:
          "China export restrictions reshape NVIDIA's product roadmap for the region",
        source: "Reuters",
        time: "11h ago",
      },
    ],
  },

  TSLA: {
    name: "Tesla Inc.",
    sector: "Auto / EV",
    exchange: "NASDAQ",
    stats: [
      { label: "Market Cap", value: "$564B" },
      { label: "P/E Ratio", value: "47.8x" },
      { label: "EPS", value: "$3.71" },
      { label: "Revenue", value: "$96.8B" },
      { label: "52W High", value: "$278.98" },
      { label: "52W Low", value: "$138.80" },
      { label: "Avg Volume", value: "95.2M" },
      { label: "Beta", value: "2.30" },
      { label: "Div Yield", value: "0.00%" },
      { label: "Float", value: "2.8B" },
    ],
    range: { low: 138.8, current: 180.0, high: 278.98 },
    ratings: [
      { label: "Buy", pct: 42, color: "#00FF94" },
      { label: "Hold", pct: 38, color: MUTED_BAR },
      { label: "Sell", pct: 20, color: "#FF3B5C" },
    ],
    news: [
      {
        headline:
          "Tesla unveils refreshed Model Y variant with improved range and revised pricing tier",
        source: "Reuters",
        time: "3h ago",
      },
      {
        headline:
          "Robotaxi rollout timeline tightens as regulatory pilot expands to two additional cities",
        source: "WSJ",
        time: "7h ago",
      },
      {
        headline:
          "Energy storage division posts record quarter on Megapack deployment growth",
        source: "Bloomberg",
        time: "12h ago",
      },
    ],
  },

  MSFT: {
    name: "Microsoft Corp.",
    sector: "Technology",
    exchange: "NASDAQ",
    stats: [
      { label: "Market Cap", value: "$3.08T" },
      { label: "P/E Ratio", value: "36.1x" },
      { label: "EPS", value: "$11.49" },
      { label: "Revenue", value: "$227.6B" },
      { label: "52W High", value: "$430.82" },
      { label: "52W Low", value: "$309.45" },
      { label: "Avg Volume", value: "22.7M" },
      { label: "Beta", value: "0.90" },
      { label: "Div Yield", value: "0.72%" },
      { label: "Float", value: "7.4B" },
    ],
    range: { low: 309.45, current: 415.32, high: 430.82 },
    ratings: [
      { label: "Buy", pct: 78, color: "#00FF94" },
      { label: "Hold", pct: 18, color: MUTED_BAR },
      { label: "Sell", pct: 4, color: "#FF3B5C" },
    ],
    news: [
      {
        headline:
          "Microsoft Azure AI revenue surges as enterprise Copilot adoption widens across Fortune 500",
        source: "Bloomberg",
        time: "2h ago",
      },
      {
        headline:
          "Activision integration on track, Game Pass subscriber growth accelerates into holiday season",
        source: "CNBC",
        time: "6h ago",
      },
      {
        headline:
          "Microsoft expands datacenter investment in Southeast Asia to meet AI capacity demand",
        source: "Reuters",
        time: "10h ago",
      },
    ],
  },

  SPY: {
    name: "SPDR S&P 500 ETF",
    sector: "ETF",
    exchange: "NYSEARCA",
    stats: [
      { label: "AUM", value: "$521B" },
      { label: "P/E Ratio", value: "N/A" },
      { label: "EPS", value: "N/A" },
      { label: "Revenue", value: "N/A" },
      { label: "52W High", value: "$524.61" },
      { label: "52W Low", value: "$409.21" },
      { label: "Avg Volume", value: "78.4M" },
      { label: "Beta", value: "N/A" },
      { label: "Div Yield", value: "1.32%" },
      { label: "Float", value: "N/A" },
    ],
    range: { low: 409.21, current: 521.88, high: 524.61 },
    ratings: [
      { label: "Buy", pct: 55, color: "#00FF94" },
      { label: "Hold", pct: 38, color: MUTED_BAR },
      { label: "Sell", pct: 7, color: "#FF3B5C" },
    ],
    news: [
      {
        headline:
          "S&P 500 closes at fresh record as megacap tech rally extends into broader cyclicals",
        source: "WSJ",
        time: "1h ago",
      },
      {
        headline:
          "Fund flows into SPY pick up as rate-cut expectations firm following softer CPI print",
        source: "Bloomberg",
        time: "5h ago",
      },
      {
        headline:
          "Sector rotation favors industrials and financials as breadth indicators improve",
        source: "Reuters",
        time: "8h ago",
      },
    ],
  },

  META: {
    name: "Meta Platforms",
    sector: "Technology",
    exchange: "NASDAQ",
    stats: [
      { label: "Market Cap", value: "$1.34T" },
      { label: "P/E Ratio", value: "26.3x" },
      { label: "EPS", value: "$20.10" },
      { label: "Revenue", value: "$134.9B" },
      { label: "52W High", value: "$542.81" },
      { label: "52W Low", value: "$228.94" },
      { label: "Avg Volume", value: "16.8M" },
      { label: "Beta", value: "1.20" },
      { label: "Div Yield", value: "0.38%" },
      { label: "Float", value: "2.2B" },
    ],
    range: { low: 228.94, current: 528.4, high: 542.81 },
    ratings: [
      { label: "Buy", pct: 70, color: "#00FF94" },
      { label: "Hold", pct: 22, color: MUTED_BAR },
      { label: "Sell", pct: 8, color: "#FF3B5C" },
    ],
    news: [
      {
        headline:
          "Meta ad revenue growth reaccelerates as AI-driven targeting improves campaign performance",
        source: "Bloomberg",
        time: "2h ago",
      },
      {
        headline:
          "Reality Labs trims operating loss as Ray-Ban smart glasses sales beat internal forecasts",
        source: "CNBC",
        time: "6h ago",
      },
      {
        headline:
          "Threads passes new monthly active user milestone, narrowing gap with rival platform",
        source: "Reuters",
        time: "13h ago",
      },
    ],
  },
};

function getTickerData(ticker: string): TickerData {
  return TICKER_DATA[ticker] ?? TICKER_DATA.AAPL;
}

type Props = {
  selectedTicker: string;
};

export default function DetailPanel({ selectedTicker }: Props) {
  const data = getTickerData(selectedTicker);
  const [livePrice, setLivePrice] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLivePrice(null);

    fetch(`/api/quote/${selectedTicker}`)
      .then(async (res) => {
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        if (typeof json?.price === "number") {
          setLivePrice(json.price);
        }
      })
      .catch((err) => {
        console.error(`Failed to fetch quote for ${selectedTicker}:`, err);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedTicker]);

  const range =
    livePrice != null ? { ...data.range, current: livePrice } : data.range;

  return (
    <div className="flex h-full flex-col">
      <Header
        name={data.name}
        sector={data.sector}
        exchange={data.exchange}
        ticker={selectedTicker}
      />
      <StatsGrid stats={data.stats} />
      <PerformanceRange range={range} />
      <AnalystRatings ratings={data.ratings} />
      <LatestNews news={data.news} />
    </div>
  );
}

function Header({
  name,
  sector,
  exchange,
  ticker,
}: {
  name: string;
  sector: string;
  exchange: string;
  ticker: string;
}) {
  return (
    <section
      style={{ padding: "16px", borderBottom: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-2">
        <span
          className="text-text-primary font-bold"
          style={{ fontSize: "14px", letterSpacing: "-0.015em" }}
        >
          {name}
        </span>
        <span
          className="text-text-muted"
          style={{
            fontSize: "10px",
            padding: "2px 8px",
            backgroundColor: "rgb(var(--color-grey-800))",
            borderRadius: "var(--border-radius)",
            letterSpacing: "-0.015em",
          }}
        >
          {sector}
        </span>
      </div>
      <div
        className="text-text-muted font-mono"
        style={{ fontSize: "10px", marginTop: "6px", letterSpacing: "-0.015em" }}
      >
        {exchange}: {ticker}
      </div>
    </section>
  );
}

function StatsGrid({ stats }: { stats: Stat[] }) {
  return (
    <section
      style={{ padding: "16px", borderBottom: "1px solid var(--border)" }}
    >
      <div className="grid grid-cols-2 gap-x-4">
        {stats.map((stat) => (
          <div key={stat.label} style={{ paddingBottom: "16px" }}>
            <div
              className="text-text-muted uppercase"
              style={{ fontSize: "9px", letterSpacing: "0.18em" }}
            >
              {stat.label}
            </div>
            <div
              className="text-text-primary font-mono"
              style={{
                fontSize: "13px",
                letterSpacing: "-0.015em",
                marginTop: "4px",
              }}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PerformanceRange({
  range,
}: {
  range: { low: number; current: number; high: number };
}) {
  const pct = ((range.current - range.low) / (range.high - range.low)) * 100;
  const clamped = Math.max(0, Math.min(100, pct));

  return (
    <section
      style={{ padding: "16px", borderBottom: "1px solid var(--border)" }}
    >
      <div
        className="text-text-muted uppercase"
        style={{ fontSize: "9px", letterSpacing: "0.18em" }}
      >
        52W Range
      </div>

      <div
        style={{
          position: "relative",
          height: "3px",
          marginTop: "16px",
          marginBottom: "16px",
          backgroundColor: "rgb(var(--color-grey-800))",
          borderRadius: "var(--border-radius)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            height: "100%",
            width: `${clamped}%`,
            backgroundColor: "rgb(var(--color-orange))",
            borderRadius: "var(--border-radius)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: `${clamped}%`,
            width: "10px",
            height: "10px",
            transform: "translate(-50%, -50%)",
            backgroundColor: "rgb(var(--color-orange))",
            borderRadius: "9999px",
            boxShadow: "0 0 0 2px rgb(var(--color-black))",
          }}
        />
      </div>

      <div className="flex justify-between">
        <span
          className="text-text-muted font-mono"
          style={{ fontSize: "9px", letterSpacing: "-0.015em" }}
        >
          ${range.low.toFixed(2)}
        </span>
        <span
          className="text-text-muted font-mono"
          style={{ fontSize: "9px", letterSpacing: "-0.015em" }}
        >
          ${range.high.toFixed(2)}
        </span>
      </div>
    </section>
  );
}

function AnalystRatings({ ratings }: { ratings: Rating[] }) {
  return (
    <section
      style={{ padding: "16px", borderBottom: "1px solid var(--border)" }}
    >
      <div
        className="text-text-muted uppercase"
        style={{
          fontSize: "9px",
          letterSpacing: "0.18em",
          marginBottom: "12px",
        }}
      >
        Analyst Ratings
      </div>

      <div className="flex flex-col" style={{ gap: "10px" }}>
        {ratings.map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <span
              className="text-text-muted"
              style={{
                fontSize: "10px",
                width: "32px",
                letterSpacing: "-0.015em",
              }}
            >
              {r.label}
            </span>
            <div
              className="flex-1"
              style={{
                position: "relative",
                height: "3px",
                backgroundColor: "rgb(var(--color-grey-800))",
                borderRadius: "var(--border-radius)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  height: "100%",
                  width: `${r.pct}%`,
                  backgroundColor: r.color,
                  borderRadius: "var(--border-radius)",
                }}
              />
            </div>
            <span
              className="text-text-primary font-mono"
              style={{
                fontSize: "10px",
                width: "32px",
                textAlign: "right",
                letterSpacing: "-0.015em",
              }}
            >
              {r.pct}%
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function LatestNews({ news }: { news: NewsItem[] }) {
  return (
    <section style={{ padding: "16px" }}>
      <div
        className="text-text-muted uppercase"
        style={{
          fontSize: "9px",
          letterSpacing: "0.18em",
          marginBottom: "12px",
        }}
      >
        Latest News
      </div>

      <div className="flex flex-col">
        {news.map((n, i) => (
          <article
            key={n.headline}
            className="group cursor-pointer"
            style={{
              padding: "10px 0",
              borderBottom:
                i < news.length - 1 ? "1px solid var(--border)" : "none",
            }}
          >
            <h3
              className="text-text-primary line-clamp-2 transition-colors duration-150 ease-brand group-hover:text-accent"
              style={{
                fontSize: "11px",
                lineHeight: 1.4,
                letterSpacing: "-0.015em",
                margin: 0,
                fontWeight: 500,
              }}
            >
              {n.headline}
            </h3>
            <div
              className="text-text-muted"
              style={{
                fontSize: "9px",
                marginTop: "6px",
                letterSpacing: "-0.015em",
              }}
            >
              {n.source} · {n.time}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
