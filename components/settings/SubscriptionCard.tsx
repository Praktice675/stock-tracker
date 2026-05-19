"use client";

import { useState } from "react";
import type { PlanInfo } from "@/lib/subscription";

// Renders the Subscription section on /dashboard/settings. Plus users see
// their next billing date + a Manage button that opens Stripe's Customer
// Portal. Free users see the plan pitch + the same checkout flow used in
// the sidebar.
export default function SubscriptionCard({ plan }: { plan: PlanInfo }) {
  const [loading, setLoading] = useState(false);
  const isPlus = plan.plan === "plus";

  async function go(endpoint: "/api/stripe/checkout" | "/api/stripe/portal") {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const json = (await res.json()) as { url?: string; error?: string };
      if (json.url) {
        window.location.href = json.url;
        return;
      }
      alert(json.error ?? "Request failed");
    } catch {
      alert("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  const nextBilling = plan.currentPeriodEnd
    ? new Date(plan.currentPeriodEnd).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        padding: "20px 24px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "8px",
        }}
      >
        <span
          style={{
            fontSize: "15px",
            fontWeight: 700,
            color: "var(--text-primary)",
          }}
        >
          {isPlus ? "Plus plan" : "Free plan"}
        </span>
        {isPlus && (
          <span
            className="font-mono uppercase"
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.12em",
              padding: "2px 8px",
              borderRadius: 999,
              background:
                "color-mix(in srgb, var(--accent) 20%, transparent)",
              color: "var(--accent)",
              border:
                "1px solid color-mix(in srgb, var(--accent) 40%, transparent)",
            }}
          >
            Plus
          </span>
        )}
      </div>

      {isPlus ? (
        <>
          {nextBilling && (
            <p
              style={{
                fontSize: "13px",
                color: "var(--text-muted)",
                margin: 0,
                marginBottom: "4px",
              }}
            >
              Next billing: {nextBilling}
            </p>
          )}
          {plan.cancelAtPeriodEnd && (
            <p
              style={{
                fontSize: "13px",
                color: "var(--accent-red)",
                margin: 0,
                marginBottom: "4px",
              }}
            >
              Your subscription ends on this date.
            </p>
          )}
        </>
      ) : (
        <p
          style={{
            fontSize: "13px",
            color: "var(--text-muted)",
            margin: 0,
            marginBottom: "4px",
            lineHeight: 1.5,
          }}
        >
          Upgrade to Pulse Plus for unlimited AI chat, portfolio analysis,
          and smart alerts.
        </p>
      )}

      <div style={{ marginTop: "16px" }}>
        <button
          type="button"
          onClick={() =>
            go(isPlus ? "/api/stripe/portal" : "/api/stripe/checkout")
          }
          disabled={loading}
          className="font-mono uppercase"
          style={{
            padding: "9px 18px",
            borderRadius: "8px",
            background: isPlus ? "var(--bg-elevated)" : "var(--accent)",
            color: "var(--text-primary)",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.1em",
            border: isPlus ? "1px solid var(--border)" : "none",
            cursor: loading ? "wait" : "pointer",
            opacity: loading ? 0.7 : 1,
            transition: "opacity 150ms ease-out",
          }}
        >
          {loading
            ? "Loading…"
            : isPlus
              ? "Manage subscription"
              : "Upgrade to Plus"}
        </button>
      </div>
    </div>
  );
}
