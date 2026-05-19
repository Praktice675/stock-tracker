"use client";

import { useEffect, useState } from "react";

// Reads ?checkout=success on mount and shows a transient celebration toast,
// then strips the query param via history.replaceState so a hard refresh
// won't re-trigger it. Cancelled checkouts are a no-op.
export default function CheckoutSuccessToast() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "success") return;

    setVisible(true);

    params.delete("checkout");
    const next =
      window.location.pathname +
      (params.toString() ? `?${params.toString()}` : "") +
      window.location.hash;
    window.history.replaceState(null, "", next);

    const id = window.setTimeout(() => setVisible(false), 5000);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        top: "84px",
        right: "24px",
        zIndex: 1000,
        padding: "10px 16px",
        borderRadius: "10px",
        background:
          "color-mix(in srgb, var(--accent-green) 18%, var(--bg-elevated))",
        border: "1px solid var(--accent-green)",
        color: "var(--text-primary)",
        fontSize: "13px",
        fontWeight: 600,
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(-8px)",
        pointerEvents: visible ? "auto" : "none",
        transition:
          "opacity 200ms ease-out, transform 200ms ease-out",
      }}
    >
      Welcome to Pulse Plus 🎉
    </div>
  );
}
