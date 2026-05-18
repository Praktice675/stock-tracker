"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Plus } from "lucide-react";

// Single entry point for everything brokerage-related on the portfolio page:
// the orange "+ Connect brokerage" trigger in the greeting block, plus a
// dropdown listing existing connections with inline disconnect controls.
// Replaces the old standalone BrokerageConnections section that lived in the
// page body.

type Connection = {
  id: string;
  broker_slug: string;
  broker_name: string;
  connected_at: string;
  last_synced_at: string | null;
  status: string;
  disabled_at: string | null;
};

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return iso;
  const day = 86400000;
  if (diff < day) return "Connected today";
  const days = Math.floor(diff / day);
  if (days === 1) return "Connected yesterday";
  if (days < 30) return `Connected ${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return "Connected 1 month ago";
  if (months < 12) return `Connected ${months} months ago`;
  const years = Math.floor(months / 12);
  return years === 1 ? "Connected 1 year ago" : `Connected ${years} years ago`;
}

export default function BrokerageConnectMenu() {
  const router = useRouter();
  const search = useSearchParams();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadConnections = useCallback(async () => {
    try {
      const res = await fetch("/api/brokerage/connections", {
        cache: "no-store",
      });
      if (!res.ok) {
        setConnections([]);
        return;
      }
      const data = await res.json();
      setConnections(
        Array.isArray(data.connections) ? data.connections : [],
      );
    } catch (err) {
      console.warn("connections load failed:", err);
      setConnections([]);
    }
  }, []);

  // Initial load — runs whether or not the dropdown is open so the user
  // sees an already-populated list on first click.
  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  // Return-from-portal handler (?snaptrade=success). Identical flow to the
  // legacy BrokerageConnections component: hit the refresh route, reload the
  // list, strip the query param. Auto-opens the dropdown so the user sees
  // the new connection.
  useEffect(() => {
    if (search.get("snaptrade") !== "success") return;
    let cancelled = false;
    setFinalizing(true);
    setError(null);
    setOpen(true);
    (async () => {
      try {
        const res = await fetch("/api/brokerage/connections/refresh", {
          method: "POST",
          cache: "no-store",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          if (!cancelled) {
            setError(body?.error ?? "Couldn't finalize the connection.");
          }
        }
        await loadConnections();
      } catch (err) {
        console.warn("brokerage refresh failed:", err);
        if (!cancelled) setError("Couldn't finalize the connection.");
      } finally {
        if (!cancelled) {
          setFinalizing(false);
          router.replace("/dashboard/portfolio");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search, router, loadConnections]);

  // Outside click closes
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const node = containerRef.current;
      if (node && !node.contains(e.target as Node)) {
        setOpen(false);
        setConfirmId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Escape closes
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setConfirmId(null);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  async function handleConnect() {
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/brokerage/connect", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Couldn't start the connection.");
        setConnecting(false);
        return;
      }
      const data = await res.json();
      if (
        typeof data?.redirectURI === "string" &&
        data.redirectURI.length > 0
      ) {
        window.location.href = data.redirectURI;
        return; // navigate away — leave connecting=true
      }
      setError("SnapTrade didn't return a redirect URL.");
      setConnecting(false);
    } catch (err) {
      console.warn("connect failed:", err);
      setError("Couldn't start the connection.");
      setConnecting(false);
    }
  }

  async function handleDisconnect(id: string) {
    setDisconnectingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/brokerage/connections/${id}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Couldn't disconnect.");
      }
      // Reload local state, then ask the page to refresh so server-rendered
      // data (BrokerageHoldings, hero totals, etc.) reflect the new reality.
      await loadConnections();
      router.refresh();
    } catch (err) {
      console.warn("disconnect failed:", err);
      setError("Couldn't disconnect.");
    } finally {
      setDisconnectingId(null);
      setConfirmId(null);
    }
  }

  const active = connections.filter((c) => c.status === "active");

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Connect brokerage menu"
        style={{
          background: "var(--accent)",
          color: "var(--text-primary)",
          padding: "8px 16px",
          borderRadius: "10px",
          fontSize: "13px",
          fontWeight: 700,
          textDecoration: "none",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          border: "none",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <Plus size={14} aria-hidden="true" />
        Connect brokerage
        <ChevronDown
          size={12}
          aria-hidden="true"
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 150ms ease-out",
          }}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Brokerage connections"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            minWidth: "320px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "12px",
            zIndex: 50,
            boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
          }}
        >
          {finalizing && (
            <div
              className="font-mono"
              style={{
                fontSize: "11px",
                color: "var(--text-muted)",
                letterSpacing: "-0.015em",
                marginBottom: "8px",
                padding: "8px 10px",
                background: "var(--bg-surface)",
                borderRadius: "8px",
              }}
            >
              Finalizing connection…
            </div>
          )}

          {active.length > 0 && (
            <>
              <div
                className="font-mono uppercase"
                style={{
                  fontSize: "9px",
                  letterSpacing: "0.25em",
                  color: "var(--text-muted)",
                  marginBottom: "8px",
                  paddingLeft: "2px",
                }}
              >
                Connected
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {active.map((c) => (
                  <ConnectionRow
                    key={c.id}
                    connection={c}
                    busy={disconnectingId === c.id}
                    confirming={confirmId === c.id}
                    onAskConfirm={() => setConfirmId(c.id)}
                    onCancelConfirm={() => setConfirmId(null)}
                    onConfirmDisconnect={() => handleDisconnect(c.id)}
                  />
                ))}
              </div>
              <div
                style={{
                  height: "1px",
                  background: "var(--border)",
                  margin: "8px 0",
                }}
              />
            </>
          )}

          <button
            type="button"
            role="menuitem"
            onClick={handleConnect}
            disabled={connecting}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "8px",
              background: "var(--accent)",
              color: "var(--text-primary)",
              fontSize: "13px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              border: "none",
              cursor: connecting ? "wait" : "pointer",
              opacity: connecting ? 0.7 : 1,
              fontFamily: "inherit",
              transition: "opacity 150ms ease-out",
            }}
          >
            <Plus size={14} aria-hidden="true" />
            {connecting ? "Connecting…" : "Connect a new brokerage"}
          </button>

          {error && (
            <p
              className="font-mono"
              style={{
                marginTop: "10px",
                marginBottom: 0,
                fontSize: "11px",
                color: "var(--accent-red)",
                letterSpacing: "-0.015em",
              }}
            >
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ConnectionRow({
  connection: c,
  busy,
  confirming,
  onAskConfirm,
  onCancelConfirm,
  onConfirmDisconnect,
}: {
  connection: Connection;
  busy: boolean;
  confirming: boolean;
  onAskConfirm: () => void;
  onCancelConfirm: () => void;
  onConfirmDisconnect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const rowStyle: CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    padding: "10px",
    borderRadius: "8px",
    background: hovered ? "var(--bg-surface)" : "transparent",
    transition: "background-color 120ms ease-out",
  };

  return (
    <div
      role="menuitem"
      style={rowStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "2px",
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontSize: "13px",
            color: "var(--text-primary)",
            fontWeight: 600,
          }}
        >
          {c.broker_name || c.broker_slug || "Brokerage"}
        </span>
        <span
          className="font-mono"
          style={{
            fontSize: "11px",
            color: "var(--text-muted)",
            letterSpacing: "-0.015em",
          }}
        >
          {relativeDate(c.connected_at)}
        </span>
      </div>

      {confirming ? (
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <ConfirmButton
            label={busy ? "…" : "Yes"}
            onClick={onConfirmDisconnect}
            disabled={busy}
          />
          <GhostButton
            label="Cancel"
            onClick={onCancelConfirm}
            disabled={busy}
          />
        </div>
      ) : (
        <DisconnectButton onClick={onAskConfirm} />
      )}
    </div>
  );
}

function DisconnectButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="font-mono uppercase"
      style={{
        padding: "4px 10px",
        fontSize: "9px",
        letterSpacing: "0.2em",
        background: "transparent",
        color: hovered ? "var(--accent-red)" : "var(--text-muted)",
        border: `1px solid ${
          hovered ? "var(--accent-red)" : "var(--border)"
        }`,
        borderRadius: "6px",
        cursor: "pointer",
        transition: "color 150ms ease, border-color 150ms ease",
      }}
    >
      Disconnect
    </button>
  );
}

function ConfirmButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="font-mono uppercase"
      style={{
        padding: "4px 8px",
        fontSize: "9px",
        letterSpacing: "0.15em",
        background: "var(--accent-red)",
        color: "var(--text-primary)",
        border: "none",
        borderRadius: "6px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        fontWeight: 700,
      }}
    >
      {label}
    </button>
  );
}

function GhostButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="font-mono uppercase"
      style={{
        padding: "4px 8px",
        fontSize: "9px",
        letterSpacing: "0.15em",
        background: "transparent",
        color: "var(--text-muted)",
        border: "1px solid var(--border)",
        borderRadius: "6px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {label}
    </button>
  );
}
