"use client";

import { useState } from "react";
import DetailPanel from "@/components/DetailPanel";
import StockChart from "@/components/StockChart";
import Watchlist from "@/components/Watchlist";

export default function Home() {
  const [selectedTicker, setSelectedTicker] = useState("AAPL");

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-bg-primary text-text-primary">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <aside
          className="flex h-full w-[260px] shrink-0 flex-col overflow-y-auto bg-bg-surface [&::-webkit-scrollbar]:hidden"
          style={{
            borderRight: "1px solid var(--border)",
            scrollbarWidth: "none",
          }}
          aria-label="Watchlist"
        >
          <Watchlist
            selectedTicker={selectedTicker}
            onSelect={setSelectedTicker}
          />
        </aside>

        <main
          className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-bg-primary"
          style={{ height: "100%" }}
        >
          <StockChart selectedTicker={selectedTicker} />
        </main>

        <aside
          className="flex h-full w-[320px] shrink-0 flex-col overflow-y-auto bg-bg-surface [&::-webkit-scrollbar]:hidden"
          style={{
            borderLeft: "1px solid var(--border)",
            scrollbarWidth: "none",
          }}
          aria-label="Detail panel"
        >
          <DetailPanel selectedTicker={selectedTicker} />
        </aside>
      </div>
    </div>
  );
}

function Header() {
  return (
    <header
      className="flex h-[65px] w-full shrink-0 items-center px-6"
      style={{
        backgroundColor: "rgb(var(--color-orange))",
        borderBottom: "1px solid var(--border)",
        color: "rgb(var(--color-black))",
      }}
    >
      <div className="flex items-center gap-3">
        <span
          className="live-dot inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: "rgb(var(--color-black))" }}
          aria-hidden="true"
        />
        <span
          className="text-sm font-semibold uppercase"
          style={{
            letterSpacing: "0.25em",
            color: "rgb(var(--color-black))",
          }}
        >
          Market
        </span>
      </div>
    </header>
  );
}
