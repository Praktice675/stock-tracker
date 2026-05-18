import { NextResponse } from "next/server";
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

  const body = await request.json().catch(() => ({}));
  const display_name =
    typeof body?.display_name === "string" ? body.display_name.trim() : null;
  const avatar_url =
    typeof body?.avatar_url === "string" && body.avatar_url.trim().length > 0
      ? body.avatar_url.trim()
      : null;

  if (!display_name || display_name.length < 1 || display_name.length > 60) {
    return NextResponse.json(
      { error: "Display name must be 1–60 characters." },
      { status: 400 },
    );
  }
  if (avatar_url && !/^https?:\/\//i.test(avatar_url)) {
    return NextResponse.json(
      { error: "Avatar URL must start with http:// or https://" },
      { status: 400 },
    );
  }

  const { error } = await supabase.from("user_profiles").upsert(
    {
      user_id: user.id,
      display_name,
      avatar_url,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.warn("user/profile upsert error:", error.message);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
