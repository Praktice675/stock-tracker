import { NextRequest, NextResponse } from "next/server";
import { snaptrade } from "@/lib/snaptrade/client";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// POST /api/brokerage/connect
// - Ensures a SnapTrade user exists for the current Supabase user
// - Mints a hosted-portal redirect URL the client should send the user to
export async function POST(request: NextRequest) {
  if (!process.env.SNAPTRADE_CLIENT_ID || !process.env.SNAPTRADE_CONSUMER_SECRET) {
    return NextResponse.json(
      { error: "SnapTrade is not configured." },
      { status: 500 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Reuse the SnapTrade user/secret across all of this user's connections.
  // A pending row from a previous abandoned attempt is also valid for reuse.
  const { data: existingRows, error: selectErr } = await supabase
    .from("brokerage_connections")
    .select("snaptrade_user_id, snaptrade_user_secret, id, status")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);
  if (selectErr) {
    console.warn("brokerage/connect: select failed:", selectErr.message);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  let snaptradeUserId: string | null = null;
  let snaptradeUserSecret: string | null = null;

  if (existingRows && existingRows.length > 0) {
    snaptradeUserId = existingRows[0].snaptrade_user_id;
    snaptradeUserSecret = existingRows[0].snaptrade_user_secret;
  } else {
    // First time — register a SnapTrade user keyed off our Supabase uid.
    try {
      const registerResp = await snaptrade.authentication.registerSnapTradeUser({
        userId: user.id,
      });
      snaptradeUserId = registerResp.data?.userId ?? null;
      snaptradeUserSecret = registerResp.data?.userSecret ?? null;
    } catch (err) {
      console.error(
        "brokerage/connect: registerSnapTradeUser failed:",
        err instanceof Error ? err.message : err,
      );
      return NextResponse.json(
        { error: "Failed to register SnapTrade user." },
        { status: 502 },
      );
    }

    if (!snaptradeUserId || !snaptradeUserSecret) {
      return NextResponse.json(
        { error: "SnapTrade returned an incomplete user record." },
        { status: 502 },
      );
    }

    // Create a pending row so we have somewhere to keep the credentials.
    const { error: insertErr } = await supabase
      .from("brokerage_connections")
      .insert({
        user_id: user.id,
        snaptrade_user_id: snaptradeUserId,
        snaptrade_user_secret: snaptradeUserSecret,
        authorization_id: "pending",
        broker_slug: "",
        broker_name: "",
        status: "pending",
      });
    if (insertErr) {
      console.warn("brokerage/connect: insert failed:", insertErr.message);
      return NextResponse.json({ error: "DB error" }, { status: 500 });
    }
  }

  // Build the redirect URL — origin from the incoming request so dev and prod
  // both Just Work (assuming the URL is whitelisted in the SnapTrade dashboard).
  const origin = request.nextUrl.origin;
  const customRedirect = `${origin}/dashboard/portfolio?snaptrade=success`;

  try {
    const loginResp = await snaptrade.authentication.loginSnapTradeUser({
      userId: snaptradeUserId!,
      userSecret: snaptradeUserSecret!,
      customRedirect,
      connectionType: "read",
    });

    const data = loginResp.data as { redirectURI?: string };
    if (!data?.redirectURI) {
      return NextResponse.json(
        { error: "SnapTrade did not return a redirect URL." },
        { status: 502 },
      );
    }

    return NextResponse.json({ redirectURI: data.redirectURI });
  } catch (err) {
    console.error(
      "brokerage/connect: loginSnapTradeUser failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: "Failed to start brokerage connection." },
      { status: 502 },
    );
  }
}
