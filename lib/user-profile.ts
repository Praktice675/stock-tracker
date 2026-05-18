// Server-side helper that resolves the current user's display name and
// avatar URL, with sensible fallbacks. Used by DashboardChrome (to feed the
// sidebar / navbar), the portfolio greeting, and the settings page.

import { createClient } from "@/lib/supabase/server";

export type UserProfile = {
  display_name: string | null;
  avatar_url: string | null;
};

export type ResolvedUserProfile = {
  userId: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
};

export async function getUserProfile(): Promise<ResolvedUserProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("display_name, avatar_url")
    .eq("user_id", user.id)
    .maybeSingle();

  const fallback = user.email?.split("@")[0] ?? "there";
  return {
    userId: user.id,
    email: user.email ?? null,
    displayName: profile?.display_name?.trim() || fallback,
    avatarUrl: profile?.avatar_url || null,
  };
}
