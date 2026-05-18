import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/brokerage/connections
// Returns active connections only. Never returns the SnapTrade user secret.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("brokerage_connections")
    .select(
      "id, broker_slug, broker_name, connected_at, last_synced_at, status, disabled_at",
    )
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("connected_at", { ascending: false });

  if (error) {
    console.warn("brokerage/connections GET: select failed:", error.message);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  return NextResponse.json({ connections: data ?? [] });
}
