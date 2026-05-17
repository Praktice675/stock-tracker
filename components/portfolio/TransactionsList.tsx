"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RawTransaction } from "@/lib/portfolio/compute";

const POSITIVE = "#00FF94";
const NEGATIVE = "#FF3B5C";

function fmtMoney(n: number): string {
  return (
    "$" +
    n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function toDateInputValue(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

type RowState =
  | { mode: "idle" }
  | { mode: "edit"; shares: string; price: string; date: string }
  | { mode: "delete-confirm" };

export default function TransactionsList({
  transactions,
}: {
  transactions: RawTransaction[];
}) {
  const router = useRouter();
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  const [busy, setBusy] = useState<string | null>(null);

  if (transactions.length === 0) {
    return (
      <div
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--border-radius)",
          padding: "32px",
          textAlign: "center",
        }}
      >
        <p
          className="text-text-muted"
          style={{
            fontSize: "12px",
            letterSpacing: "-0.015em",
          }}
        >
          No transactions yet.
        </p>
      </div>
    );
  }

  const setRow = (id: string, state: RowState) =>
    setRowStates((prev) => ({ ...prev, [id]: state }));

  const handleEdit = (tx: RawTransaction) => {
    setRow(tx.id, {
      mode: "edit",
      shares: String(tx.shares),
      price: String(tx.price),
      date: toDateInputValue(tx.executed_at),
    });
  };

  const handleCancel = (id: string) => setRow(id, { mode: "idle" });

  const handleSave = async (
    tx: RawTransaction,
    s: { shares: string; price: string; date: string },
  ) => {
    const shares = parseFloat(s.shares);
    const price = parseFloat(s.price);
    if (
      !Number.isFinite(shares) ||
      shares <= 0 ||
      !Number.isFinite(price) ||
      price <= 0 ||
      !s.date
    ) {
      return;
    }
    setBusy(tx.id);
    try {
      const res = await fetch(`/api/portfolio/transactions/${tx.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shares,
          price,
          executed_at: new Date(s.date).toISOString(),
        }),
      });
      if (res.ok) {
        setRow(tx.id, { mode: "idle" });
        router.refresh();
      } else {
        console.warn("Edit failed:", await res.text());
      }
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (id: string) => {
    setBusy(id);
    try {
      const res = await fetch(`/api/portfolio/transactions/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setRow(id, { mode: "idle" });
        router.refresh();
      } else {
        console.warn("Delete failed:", await res.text());
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--border-radius)",
        overflow: "hidden",
      }}
    >
      {transactions.map((tx, i) => {
        const state = rowStates[tx.id] ?? { mode: "idle" };
        const isLast = i === transactions.length - 1;
        const isBuy = tx.type === "buy";
        const isBusy = busy === tx.id;

        return (
          <div
            key={tx.id}
            className="flex items-center"
            style={{
              padding: "12px 16px",
              gap: "12px",
              borderBottom: isLast ? undefined : "1px solid var(--border)",
              fontFamily: "var(--font-mono), monospace",
              fontSize: "12px",
              letterSpacing: "-0.015em",
            }}
          >
            <span
              style={{
                display: "inline-block",
                padding: "3px 8px",
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.15em",
                borderRadius: "var(--border-radius)",
                backgroundColor: isBuy
                  ? `${POSITIVE}26`
                  : `${NEGATIVE}26`,
                color: isBuy ? POSITIVE : NEGATIVE,
                width: "44px",
                textAlign: "center",
                flexShrink: 0,
              }}
            >
              {isBuy ? "BUY" : "SELL"}
            </span>
            <span
              style={{
                color: "rgb(var(--color-orange))",
                fontWeight: 700,
                width: "60px",
                flexShrink: 0,
              }}
            >
              {tx.ticker}
            </span>

            {state.mode === "edit" ? (
              <>
                <input
                  type="number"
                  step="any"
                  value={state.shares}
                  onChange={(e) =>
                    setRow(tx.id, { ...state, shares: e.target.value })
                  }
                  className="font-mono"
                  style={inputStyle}
                  placeholder="Shares"
                />
                <input
                  type="number"
                  step="any"
                  value={state.price}
                  onChange={(e) =>
                    setRow(tx.id, { ...state, price: e.target.value })
                  }
                  className="font-mono"
                  style={inputStyle}
                  placeholder="Price"
                />
                <input
                  type="date"
                  value={state.date}
                  onChange={(e) =>
                    setRow(tx.id, { ...state, date: e.target.value })
                  }
                  className="font-mono"
                  style={{ ...inputStyle, width: "140px" }}
                />
                <div className="flex" style={{ gap: "6px", marginLeft: "auto" }}>
                  <ActionButton
                    label={isBusy ? "Saving…" : "Save"}
                    onClick={() =>
                      handleSave(tx, {
                        shares: state.shares,
                        price: state.price,
                        date: state.date,
                      })
                    }
                    primary
                    disabled={isBusy}
                  />
                  <ActionButton
                    label="Cancel"
                    onClick={() => handleCancel(tx.id)}
                    disabled={isBusy}
                  />
                </div>
              </>
            ) : (
              <>
                <span style={{ width: "80px", textAlign: "right" }}>
                  {tx.shares}
                </span>
                <span
                  className="text-text-muted"
                  style={{ width: "20px", textAlign: "center" }}
                >
                  @
                </span>
                <span style={{ width: "90px" }}>{fmtMoney(tx.price)}</span>
                <span
                  className="text-text-muted"
                  style={{ width: "110px" }}
                >
                  {fmtMoney(tx.shares * tx.price)}
                </span>
                <span
                  className="text-text-muted"
                  style={{ width: "110px" }}
                >
                  {fmtDate(tx.executed_at)}
                </span>
                <div
                  className="flex"
                  style={{ gap: "6px", marginLeft: "auto" }}
                >
                  {state.mode === "delete-confirm" ? (
                    <>
                      <span
                        className="text-text-muted"
                        style={{ fontSize: "11px", marginRight: "4px" }}
                      >
                        Delete?
                      </span>
                      <ActionButton
                        label={isBusy ? "…" : "Yes"}
                        onClick={() => handleDelete(tx.id)}
                        primary
                        danger
                        disabled={isBusy}
                      />
                      <ActionButton
                        label="Cancel"
                        onClick={() => handleCancel(tx.id)}
                        disabled={isBusy}
                      />
                    </>
                  ) : (
                    <>
                      <IconButton
                        label="Edit"
                        onClick={() => handleEdit(tx)}
                        title="Edit transaction"
                      >
                        ✎
                      </IconButton>
                      <IconButton
                        label="Delete"
                        onClick={() =>
                          setRow(tx.id, { mode: "delete-confirm" })
                        }
                        title="Delete transaction"
                      >
                        ✕
                      </IconButton>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "90px",
  height: "30px",
  padding: "0 8px",
  backgroundColor: "rgb(var(--color-grey-800))",
  border: "1px solid var(--border)",
  borderRadius: "var(--border-radius)",
  color: "var(--text-primary)",
  fontFamily: "var(--font-mono), monospace",
  fontSize: "11px",
  letterSpacing: "-0.015em",
  outline: "none",
};

function ActionButton({
  label,
  onClick,
  primary,
  danger,
  disabled,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  const bg = danger
    ? NEGATIVE
    : primary
      ? "rgb(var(--color-orange))"
      : "transparent";
  const color = primary || danger
    ? "rgb(var(--color-black))"
    : "var(--text-muted)";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="font-mono font-semibold uppercase"
      style={{
        height: "28px",
        padding: "0 12px",
        backgroundColor: bg,
        color,
        border: primary || danger ? "none" : "1px solid var(--border)",
        borderRadius: "var(--border-radius)",
        fontSize: "10px",
        letterSpacing: "0.15em",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  );
}

function IconButton({
  children,
  label,
  onClick,
  title,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={title}
      className="text-text-muted hover:text-text-primary transition-colors duration-150"
      style={{
        height: "28px",
        width: "28px",
        background: "transparent",
        border: "1px solid var(--border)",
        borderRadius: "var(--border-radius)",
        cursor: "pointer",
        fontSize: "12px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </button>
  );
}
