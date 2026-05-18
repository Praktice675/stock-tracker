import { NextResponse } from "next/server";
import { snaptrade } from "@/lib/snaptrade/client";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// DELETE /api/brokerage/connections/[id]
// Revokes the SnapTrade authorization, then removes the DB row.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // RLS already scopes this to the current user, but read the row first so
  // we have the SnapTrade credentials and authorization_id we need to call
  // out to SnapTrade.
  const { data: row, error: selectErr } = await supabase
    .from("brokerage_connections")
    .select("authorization_id, snaptrade_user_id, snaptrade_user_secret")
    .eq("id", id)
    .maybeSingle();

  if (selectErr) {
    console.warn("brokerage/connections DELETE: select failed:", selectErr.message);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Best-effort revoke at SnapTrade; we delete the row regardless of result
  // so a stale auth on their side never leaves us with an orphan row.
  if (row.authorization_id && row.authorization_id !== "pending") {
    try {
      await snaptrade.connections.removeBrokerageAuthorization({
        authorizationId: row.authorization_id,
        userId: row.snaptrade_user_id,
        userSecret: row.snaptrade_user_secret,
      });
    } catch (err) {
      console.warn(
        "brokerage/connections DELETE: SnapTrade revoke failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  const { error: deleteErr } = await supabase
    .from("brokerage_connections")
    .delete()
    .eq("id", id);
  if (deleteErr) {
    console.warn("brokerage/connections DELETE: delete failed:", deleteErr.message);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
