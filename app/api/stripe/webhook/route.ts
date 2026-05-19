import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Service client has no Database generic so query results widen to `never`.
// Mirroring the cast pattern from app/api/chat/route.ts: re-shape the result
// of `.from("subscriptions")` to the operations we actually use.
type SubscriptionsTable = {
  upsert: (
    row: Record<string, unknown>,
    opts: { onConflict: string },
  ) => Promise<{ error: { message: string } | null }>;
  update: (row: Record<string, unknown>) => {
    eq: (
      col: string,
      val: string,
    ) => Promise<{ error: { message: string } | null }>;
  };
};

function subscriptionsTable(
  db: ReturnType<typeof createServiceClient>,
): SubscriptionsTable {
  return db.from("subscriptions") as unknown as SubscriptionsTable;
}

// In recent Stripe API versions current_period_end was moved from the
// Subscription object onto each SubscriptionItem. Read it from the item
// when present, fall back to the legacy subscription-level field so this
// keeps working across API version upgrades.
function getPeriodEnd(sub: Stripe.Subscription): string | null {
  const itemEnd = sub.items?.data?.[0]?.current_period_end;
  if (typeof itemEnd === "number") {
    return new Date(itemEnd * 1000).toISOString();
  }
  const legacy = (sub as unknown as { current_period_end?: number })
    .current_period_end;
  if (typeof legacy === "number") {
    return new Date(legacy * 1000).toISOString();
  }
  return null;
}

export async function POST(request: Request) {
  if (!WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const db = createServiceClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId =
          session.metadata?.user_id || session.client_reference_id;
        if (!userId) break;

        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id ?? null;
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id ?? null;

        let periodEnd: string | null = null;
        let cancelAtPeriodEnd = false;
        let status: string | null = null;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          periodEnd = getPeriodEnd(sub);
          cancelAtPeriodEnd = sub.cancel_at_period_end;
          status = sub.status;
        }

        await subscriptionsTable(db).upsert(
          {
            user_id: userId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subId,
            plan: "plus",
            status,
            current_period_end: periodEnd,
            cancel_at_period_end: cancelAtPeriodEnd,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.user_id;
        if (!userId) break;
        const isActive = ["active", "trialing", "past_due"].includes(
          sub.status,
        );
        await subscriptionsTable(db).upsert(
          {
            user_id: userId,
            stripe_customer_id:
              typeof sub.customer === "string"
                ? sub.customer
                : sub.customer?.id,
            stripe_subscription_id: sub.id,
            plan: isActive ? "plus" : "free",
            status: sub.status,
            current_period_end: getPeriodEnd(sub),
            cancel_at_period_end: sub.cancel_at_period_end,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.user_id;
        if (!userId) break;
        await subscriptionsTable(db)
          .update({
            plan: "free",
            status: "canceled",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id;
        if (!customerId) break;
        await subscriptionsTable(db)
          .update({
            status: "past_due",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_customer_id", customerId);
        break;
      }

      case "invoice.payment_succeeded":
        // No-op — subscription.updated covers state transitions.
        break;

      default:
        console.log(`Unhandled Stripe event: ${event.type}`);
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
