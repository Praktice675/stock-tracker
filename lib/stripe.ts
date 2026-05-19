import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

// Pin to the apiVersion the installed SDK's TypeScript types expect. Bumping
// the SDK will also bump this string; keep them in sync.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-04-22.dahlia",
});

export const STRIPE_PRICE_ID_PLUS = process.env.STRIPE_PRICE_ID_PLUS;
