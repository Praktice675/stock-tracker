"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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

export default function BrokerageConnections() {
  const router = useRouter();
  const search = useSearchParams();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
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

  // Initial load
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadConnections().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [loadConnections]);

  // Return-from-portal handler
  useEffect(() => {
    if (search.get("snaptrade") !== "success") return;
    let cancelled = false;
    setFinalizing(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch("/api/brokerage/connections/refresh", {
          method: "POST",
          cache: "no-store",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setError(body?.error ?? "Couldn't finalize the connection.");
        }
        await loadConnections();
      } catch (err) {
        console.warn("brokerage refresh failed:", err);
        if (!cancelled) setError("Couldn't finalize the connection.");
      } finally {
        if (!cancelled) {
          setFinalizing(false);
          // Strip the ?snaptrade=success query param without a full reload.
          router.replace("/dashboard/portfolio");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search, router, loadConnections]);

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
      if (typeof data?.redirectURI === "string" && data.redirectURI.length > 0) {
        window.location.href = data.redirectURI;
        return; // navigate away — don't reset connecting state
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
      await loadConnections();
    } catch (err) {
      console.warn("disconnect failed:", err);
      setError("Couldn't disconnect.");
    } finally {
      setDisconnectingId(null);
      setConfirmId(null);
    }
  }

  return (
    <section style={{ marginBottom: "24px" }}>
      <h2
        className="font-mono uppercase"
        style={{
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.25em",
          color: "var(--text-muted)",
          margin: 0,
          marginBottom: "12px",
        }}
      >
        Brokerage Accounts
      </h2>

      {finalizing ? (
        <ConnectionCard>
          <p style={mutedText}>Finalizing connection…</p>
        </ConnectionCard>
      ) : loading ? (
        <ConnectionCard>
          <p style={mutedText}>Loading…</p>
        </ConnectionCard>
      ) : connections.length === 0 ? (
        <ConnectionCard>
          <p
            style={{
              ...mutedText,
              marginBottom: "16px",
              lineHeight: 1.5,
            }}
          >
            Connect your brokerage to automatically import your holdings and
            transactions.
          </p>
          <PrimaryButton
            label={connecting ? "Connecting…" : "Connect brokerage"}
            onClick={handleConnect}
            disabled={connecting}
          />
        </ConnectionCard>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {connections.map((c) => {
            const isBusy = disconnectingId === c.id;
            const isConfirming = confirmId === c.id;
            return (
              <ConnectionCard key={c.id}>
                <div
                  className="flex items-center"
                  style={{
                    justifyContent: "space-between",
                    gap: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                      minWidth: 0,
                    }}
                  >
                    <span
                      className="font-mono"
                      style={{
                        fontSize: "13px",
                        fontWeight: 700,
                        letterSpacing: "-0.015em",
                        color: "var(--text-primary)",
                      }}
                    >
                      {c.broker_name || c.broker_slug || "Brokerage"}
                    </span>
                    <span
                      className="font-mono"
                      style={{
                        fontSize: "11px",
                        letterSpacing: "-0.015em",
                        color: "var(--text-muted)",
                      }}
                    >
                      {relativeDate(c.connected_at)}
                    </span>
                  </div>

                  {isConfirming ? (
                    <div
                      className="flex items-center"
                      style={{ gap: "8px" }}
                    >
                      <span
                        className="font-mono"
                        style={{
                          fontSize: "11px",
                          color: "var(--text-muted)",
                          letterSpacing: "-0.015em",
                        }}
                      >
                        Disconnect {c.broker_name || "this account"}?
                      </span>
                      <DangerButton
                        label={isBusy ? "…" : "Yes"}
                        onClick={() => handleDisconnect(c.id)}
                        disabled={isBusy}
                      />
                      <GhostButton
                        label="Cancel"
                        onClick={() => setConfirmId(null)}
                        disabled={isBusy}
                      />
                    </div>
                  ) : (
                    <DisconnectButton
                      label="Disconnect"
                      onClick={() => setConfirmId(c.id)}
                    />
                  )}
                </div>
              </ConnectionCard>
            );
          })}

          <div>
            <PrimaryButton
              label={connecting ? "Connecting…" : "Connect another"}
              onClick={handleConnect}
              disabled={connecting}
            />
          </div>
        </div>
      )}

      {error && (
        <p
          className="font-mono"
          style={{
            marginTop: "10px",
            fontSize: "11px",
            color: "var(--accent-red)",
            letterSpacing: "-0.015em",
          }}
        >
          {error}
        </p>
      )}
    </section>
  );
}

// ---------- presentational helpers ----------

const mutedText: React.CSSProperties = {
  fontSize: "13px",
  letterSpacing: "-0.015em",
  color: "var(--text-muted)",
  margin: 0,
};

function ConnectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--border-radius)",
        padding: "16px 20px",
      }}
    >
      {children}
    </div>
  );
}

function PrimaryButton({
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
      className="font-mono font-bold uppercase transition-opacity"
      style={{
        padding: "10px 18px",
        fontSize: "11px",
        letterSpacing: "0.2em",
        backgroundColor: "var(--accent)",
        color: "rgb(var(--color-black))",
        border: "none",
        borderRadius: "var(--border-radius)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {label}
    </button>
  );
}

function DangerButton({
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
      className="font-mono font-semibold uppercase"
      style={{
        padding: "5px 12px",
        fontSize: "10px",
        letterSpacing: "0.18em",
        backgroundColor: "var(--accent-red)",
        color: "rgb(var(--color-black))",
        border: "none",
        borderRadius: "var(--border-radius)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
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
      className="font-mono font-semibold uppercase"
      style={{
        padding: "5px 12px",
        fontSize: "10px",
        letterSpacing: "0.18em",
        backgroundColor: "transparent",
        color: "var(--text-muted)",
        border: "1px solid var(--border)",
        borderRadius: "var(--border-radius)",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {label}
    </button>
  );
}

function DisconnectButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-mono uppercase brokerage-disconnect"
      style={{
        padding: "5px 10px",
        fontSize: "10px",
        letterSpacing: "0.18em",
        backgroundColor: "transparent",
        color: "var(--text-muted)",
        border: "1px solid var(--border)",
        borderRadius: "var(--border-radius)",
        cursor: "pointer",
        transition: "color 150ms ease, border-color 150ms ease",
      }}
    >
      {label}
    </button>
  );
}
