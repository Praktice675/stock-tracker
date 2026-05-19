import { NextResponse } from "next/server";
import { stripe, STRIPE_PRICE_ID_PLUS } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!STRIPE_PRICE_ID_PLUS) {
    return NextResponse.json(
      { error: "Price ID not configured" },
      { status: 500 },
    );
  }

  // Reuse an existing Stripe customer ID when we have one so repeat upgrades
  // don't create a second customer record under the same auth user.
  const { data: existingSub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const origin =
    request.headers.get("origin") ??
    "https://stock-tracker-topaz-delta.vercel.app";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: STRIPE_PRICE_ID_PLUS, quantity: 1 }],
    customer: existingSub?.stripe_customer_id ?? undefined,
    customer_email: existingSub?.stripe_customer_id
      ? undefined
      : (user.email ?? undefined),
    client_reference_id: user.id,
    metadata: { user_id: user.id },
    subscription_data: { metadata: { user_id: user.id } },
    success_url: `${origin}/dashboard/portfolio?checkout=success`,
    cancel_url: `${origin}/dashboard/portfolio?checkout=cancelled`,
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: session.url });
}
