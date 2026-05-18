import { NextResponse } from "next/server";
import { snaptrade } from "@/lib/snaptrade/client";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type BrokerageAuthorizationLite = {
  id?: string;
  brokerage?: {
    slug?: string;
    name?: string;
    display_name?: string;
  };
};

// POST /api/brokerage/connections/refresh
// Called when the user returns from SnapTrade's hosted portal. Reconciles
// the real list of SnapTrade authorizations into our brokerage_connections
// table and clears any leftover 'pending' row.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Any existing row (pending or active) holds the SnapTrade credentials we
  // need to query their API.
  const { data: rows, error: selectErr } = await supabase
    .from("brokerage_connections")
    .select("id, authorization_id, snaptrade_user_id, snaptrade_user_secret, status")
    .eq("user_id", user.id);
  if (selectErr) {
    console.warn("brokerage refresh: select failed:", selectErr.message);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
  if (!rows || rows.length === 0) {
    // Nothing pending — likely the user hit /refresh without ever clicking Connect.
    return NextResponse.json({ connections: [] });
  }

  const snaptradeUserId = rows[0].snaptrade_user_id;
  const snaptradeUserSecret = rows[0].snaptrade_user_secret;

  let authsResp;
  try {
    authsResp = await snaptrade.connections.listBrokerageAuthorizations({
      userId: snaptradeUserId,
      userSecret: snaptradeUserSecret,
    });
  } catch (err) {
    console.error(
      "brokerage refresh: listBrokerageAuthorizations failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: "Failed to fetch brokerage authorizations." },
      { status: 502 },
    );
  }

  const remoteAuths: BrokerageAuthorizationLite[] = Array.isArray(authsResp.data)
    ? (authsResp.data as BrokerageAuthorizationLite[])
    : [];

  // What's already in our DB by SnapTrade authorization id (excluding pending).
  const knownAuthIds = new Set(
    rows
      .filter((r) => r.authorization_id && r.authorization_id !== "pending")
      .map((r) => r.authorization_id),
  );

  // Insert one row per new SnapTrade authorization.
  const newRows = remoteAuths
    .filter((a) => a.id && !knownAuthIds.has(a.id))
    .map((a) => ({
      user_id: user.id,
      snaptrade_user_id: snaptradeUserId,
      snaptrade_user_secret: snaptradeUserSecret,
      authorization_id: a.id as string,
      broker_slug: a.brokerage?.slug ?? "",
      broker_name:
        a.brokerage?.display_name ?? a.brokerage?.name ?? a.brokerage?.slug ?? "Brokerage",
      status: "active",
    }));

  if (newRows.length > 0) {
    const { error: insertErr } = await supabase
      .from("brokerage_connections")
      .insert(newRows);
    if (insertErr) {
      console.warn("brokerage refresh: insert failed:", insertErr.message);
      return NextResponse.json({ error: "DB error" }, { status: 500 });
    }
  }

  // Clear pending placeholder rows now that real authorizations have landed.
  const pendingIds = rows
    .filter((r) => r.status === "pending" || r.authorization_id === "pending")
    .map((r) => r.id);
  if (pendingIds.length > 0) {
    await supabase
      .from("brokerage_connections")
      .delete()
      .in("id", pendingIds);
  }

  const { data: refreshed, error: finalErr } = await supabase
    .from("brokerage_connections")
    .select(
      "id, broker_slug, broker_name, connected_at, last_synced_at, status, disabled_at",
    )
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("connected_at", { ascending: false });
  if (finalErr) {
    console.warn("brokerage refresh: final select failed:", finalErr.message);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  return NextResponse.json({ connections: refreshed ?? [] });
}
