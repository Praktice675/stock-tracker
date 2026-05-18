"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { addTransaction } from "@/lib/db/portfolio";

type Props = {
  variant?: "primary" | "cta";
};

export default function AddTransactionDialog({ variant = "primary" }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ticker, setTicker] = useState("");
  const [type, setType] = useState<"buy" | "sell">("buy");
  const [shares, setShares] = useState("");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, submitting]);

  function reset() {
    setTicker("");
    setType("buy");
    setShares("");
    setPrice("");
    setDate(new Date().toISOString().slice(0, 10));
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const t = ticker.trim().toUpperCase();
    const s = parseFloat(shares);
    const p = parseFloat(price);
    if (
      !t ||
      !Number.isFinite(s) ||
      s <= 0 ||
      !Number.isFinite(p) ||
      p <= 0
    ) {
      setError("Enter a valid ticker, shares, and price.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      // Note: addTransaction doesn't accept executed_at yet, so the timestamp
      // defaults to now() server-side. Editing the row afterwards can change it.
      await addTransaction(t, type, s, p);
      void date; // documented in note above
      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add transaction");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-mono font-bold uppercase"
        style={{
          padding: variant === "cta" ? "14px 28px" : "10px 18px",
          fontSize: variant === "cta" ? "13px" : "11px",
          letterSpacing: "0.2em",
          backgroundColor: "var(--accent)",
          color: "rgb(var(--color-black))",
          border: "none",
          borderRadius: "var(--border-radius)",
          cursor: "pointer",
        }}
      >
        + Add Transaction
      </button>

      {open && (
        <div
          onClick={() => !submitting && setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            backgroundColor: "rgba(0, 0, 0, 0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "420px",
              backgroundColor: "rgb(var(--color-grey-900))",
              border: "1px solid var(--border)",
              borderRadius: "var(--border-radius)",
              padding: "24px",
            }}
          >
            <h2
              className="font-mono uppercase"
              style={{
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.22em",
                color: "var(--accent)",
                margin: 0,
                marginBottom: "20px",
              }}
            >
              New Transaction
            </h2>

            <form onSubmit={handleSubmit} className="flex flex-col" style={{ gap: "14px" }}>
              <Field label="Ticker">
                <input
                  type="text"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  placeholder="AAPL"
                  required
                  autoComplete="off"
                  autoFocus
                  style={fieldStyle}
                />
              </Field>

              <Field label="Type">
                <div className="flex" style={{ gap: "8px" }}>
                  <TypeButton
                    label="BUY"
                    active={type === "buy"}
                    onClick={() => setType("buy")}
                  />
                  <TypeButton
                    label="SELL"
                    active={type === "sell"}
                    onClick={() => setType("sell")}
                  />
                </div>
              </Field>

              <div className="grid grid-cols-2" style={{ gap: "12px" }}>
                <Field label="Shares">
                  <input
                    type="number"
                    step="any"
                    value={shares}
                    onChange={(e) => setShares(e.target.value)}
                    placeholder="10"
                    required
                    min="0"
                    style={fieldStyle}
                  />
                </Field>
                <Field label="Price">
                  <input
                    type="number"
                    step="any"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="150.00"
                    required
                    min="0"
                    style={fieldStyle}
                  />
                </Field>
              </div>

              <Field label="Date">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  style={fieldStyle}
                />
              </Field>

              {error && (
                <div
                  style={{
                    color: "#ef4444",
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: "11px",
                    letterSpacing: "-0.015em",
                  }}
                >
                  {error}
                </div>
              )}

              <div
                className="flex"
                style={{ gap: "8px", marginTop: "8px", justifyContent: "flex-end" }}
              >
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={submitting}
                  className="font-mono font-semibold uppercase"
                  style={{
                    height: "36px",
                    padding: "0 16px",
                    background: "transparent",
                    color: "var(--text-muted)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--border-radius)",
                    fontSize: "11px",
                    letterSpacing: "0.18em",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="font-mono font-bold uppercase"
                  style={{
                    height: "36px",
                    padding: "0 18px",
                    backgroundColor: "var(--accent)",
                    color: "rgb(var(--color-black))",
                    border: "none",
                    borderRadius: "var(--border-radius)",
                    fontSize: "11px",
                    letterSpacing: "0.18em",
                    cursor: submitting ? "not-allowed" : "pointer",
                    opacity: submitting ? 0.6 : 1,
                  }}
                >
                  {submitting ? "Adding…" : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  height: "36px",
  padding: "0 12px",
  backgroundColor: "rgb(var(--color-grey-800))",
  border: "1px solid var(--border)",
  borderRadius: "var(--border-radius)",
  color: "var(--text-primary)",
  fontFamily: "var(--font-mono), monospace",
  fontSize: "12px",
  letterSpacing: "-0.015em",
  outline: "none",
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col" style={{ gap: "6px" }}>
      <span
        className="text-text-muted uppercase font-mono"
        style={{ fontSize: "10px", letterSpacing: "0.22em" }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function TypeButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-mono font-bold uppercase"
      style={{
        flex: 1,
        height: "32px",
        backgroundColor: active
          ? "var(--accent)"
          : "transparent",
        color: active ? "rgb(var(--color-black))" : "var(--text-muted)",
        border: active
          ? "1px solid var(--accent)"
          : "1px solid var(--border)",
        borderRadius: "var(--border-radius)",
        fontSize: "11px",
        letterSpacing: "0.18em",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
