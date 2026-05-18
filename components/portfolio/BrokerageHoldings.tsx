"use client";

// components/portfolio/BrokerageHoldings.tsx
//
// Displays synced positions from brokerage_positions. On mount, triggers
// a background sync (subject to the 15-min freshness gate in the backend).
// A REFRESH button forces an immediate re-sync.

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
    <div style={{ marginTop: "24px", marginBottom: "24px" }}>
      <div
        className="flex items-center"
        style={{ justifyContent: "space-between", marginBottom: "12px" }}
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
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            padding: "20px",
            color: "var(--text-muted)",
            fontSize: "13px",
          }}
        >
          {syncing
            ? "Fetching positions from your brokerage…"
            : "No positions yet. Make a trade in your brokerage to see it here."}
        </div>
      ) : (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            className="grid font-mono uppercase"
            style={{
              gridTemplateColumns: "1fr 2fr 1fr 1fr 1fr 1.2fr",
              gap: "12px",
              padding: "12px 16px",
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

          {positions.map((p, i) => (
            <div
              key={p.id}
              className="grid"
              style={{
                gridTemplateColumns: "1fr 2fr 1fr 1fr 1fr 1.2fr",
                gap: "12px",
                padding: "14px 16px",
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
                {fmtMoney(p.current_price)}
              </div>
              <div
                className="font-mono"
                style={{ textAlign: "right", fontWeight: 700 }}
              >
                {fmtMoney(p.market_value)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
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