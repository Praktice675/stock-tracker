"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import type { BrokeragePosition } from "@/lib/portfolio/brokerage";

type Props = {
  positions: BrokeragePosition[];
  hasConnections: boolean;
};

export default function BrokerageHoldings({ positions, hasConnections }: Props) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [, startTransition] = useTransition();
  const autoSyncedRef = useRef(false);

  // Live price overlay. DB columns (current_price, market_value) are the
  // baseline snapshot from the last brokerage sync; this map overrides
  // them as fresh quotes arrive without mutating the prop.
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});

  const uniqueSymbols = useMemo(() => {
    const set = new Set<string>();
    for (const p of positions) {
      if (p.symbol) set.add(p.symbol);
    }
    return Array.from(set);
  }, [positions]);

  // Stash the latest unique-symbols list in a ref so the polling effect
  // (which runs only on mount) always reads the current set without
  // re-installing intervals when positions reorder.
  const symbolsRef = useRef<string[]>(uniqueSymbols);
  symbolsRef.current = uniqueSymbols;

  useEffect(() => {
    let cancelled = false;

    const fetchOne = async (symbol: string) => {
      try {
        const res = await fetch(`/api/quote/${symbol}`, { cache: "no-store" });
        if (cancelled || !res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        if (typeof json?.price !== "number") return;
        setLivePrices((prev) =>
          prev[symbol] === json.price ? prev : { ...prev, [symbol]: json.price },
        );
      } catch (err) {
        console.warn(`Brokerage quote ${symbol} failed:`, err);
      }
    };

    const pollAll = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      const list = symbolsRef.current;
      if (list.length === 0) return;
      void Promise.all(list.map(fetchOne));
    };

    pollAll();
    let id = setInterval(pollAll, 30_000);

    const onVisibility = () => {
      if (document.hidden) {
        clearInterval(id);
      } else {
        pollAll();
        id = setInterval(pollAll, 30_000);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  async function runSync(force: boolean) {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/brokerage/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      const didSync = data?.synced?.some(
        (s: { ok?: boolean; skipped?: boolean }) => s.ok === true && !s.skipped,
      );
      if (didSync) {
        startTransition(() => router.refresh());
      }
    } catch (e) {
      console.warn("brokerage sync failed:", e);
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    if (!hasConnections || autoSyncedRef.current) return;
    autoSyncedRef.current = true;
    void runSync(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasConnections]);

  if (!hasConnections) return null;

  return (
    <Card style={{ marginTop: "24px", marginBottom: "24px" }}>
      <div
        className="flex items-center"
        style={{ justifyContent: "space-between", marginBottom: "20px" }}
      >
        <h2
          className="font-mono uppercase"
          style={{
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.25em",
            color: "var(--text-muted)",
            margin: 0,
          }}
        >
          Brokerage Holdings
        </h2>
        <button
          type="button"
          onClick={() => runSync(true)}
          disabled={syncing}
          className="font-mono uppercase ease-brand"
          style={{
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.25em",
            color: "var(--text-muted)",
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "6px 12px",
            cursor: syncing ? "wait" : "pointer",
            transition: "color 150ms, border-color 150ms",
          }}
        >
          {syncing ? "Syncing…" : "Refresh"}
        </button>
      </div>

      {positions.length === 0 ? (
        <div
          style={{
            color: "var(--text-muted)",
            fontSize: "13px",
            padding: "8px 0",
          }}
        >
          {syncing
            ? "Fetching positions from your brokerage…"
            : "No positions yet. Make a trade in your brokerage to see it here."}
        </div>
      ) : (
        <div>
          <div
            className="grid font-mono uppercase"
            style={{
              gridTemplateColumns: "1fr 2fr 1fr 1fr 1fr 1.2fr",
              gap: "12px",
              padding: "12px 0",
              borderBottom: "1px solid var(--border)",
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.25em",
              color: "var(--text-muted)",
            }}
          >
            <div>Symbol</div>
            <div>Description</div>
            <div style={{ textAlign: "right" }}>Qty</div>
            <div style={{ textAlign: "right" }}>Avg Cost</div>
            <div style={{ textAlign: "right" }}>Price</div>
            <div style={{ textAlign: "right" }}>Value</div>
          </div>

          {positions.map((p, i) => {
            const livePrice = livePrices[p.symbol];
            const displayPrice =
              typeof livePrice === "number" ? livePrice : p.current_price;
            const displayValue =
              typeof livePrice === "number"
                ? livePrice * p.quantity
                : p.market_value;
            return (
              <div
                key={p.id}
                className="grid"
                style={{
                  gridTemplateColumns: "1fr 2fr 1fr 1fr 1fr 1.2fr",
                  gap: "12px",
                  padding: "14px 0",
                  borderBottom:
                    i === positions.length - 1
                      ? "none"
                      : "1px solid var(--border)",
                  fontSize: "13px",
                  color: "var(--text-primary)",
                  alignItems: "center",
                }}
              >
                <div className="font-mono" style={{ fontWeight: 700 }}>
                  {p.symbol}
                </div>
                <div
                  style={{
                    color: "var(--text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {p.description ?? "—"}
                </div>
                <div className="font-mono" style={{ textAlign: "right" }}>
                  {fmtQty(p.quantity)}
                </div>
                <div
                  className="font-mono"
                  style={{ textAlign: "right", color: "var(--text-muted)" }}
                >
                  {fmtMoney(p.avg_cost)}
                </div>
                <div className="font-mono" style={{ textAlign: "right" }}>
                  {fmtMoney(displayPrice)}
                </div>
                <div
                  className="font-mono"
                  style={{ textAlign: "right", fontWeight: 700 }}
                >
                  {fmtMoney(displayValue)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function fmtMoney(v: number | null): string {
  if (v == null || Number.isNaN(v)) return "—";
  return Number(v).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function fmtQty(v: number): string {
  return Number(v).toLocaleString("en-US", { maximumFractionDigits: 4 });
}
