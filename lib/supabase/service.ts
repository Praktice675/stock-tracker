import { createClient } from "@supabase/supabase-js";

// SERVER-ONLY Supabase client using the service-role key. Bypasses RLS;
// intended for narrowly-scoped admin writes (e.g. incrementing the chat quota
// counter) that the user's own RLS-authenticated session cannot perform.
//
// MUST NEVER be imported from anything under /components, /app/(non-api),
// or any file that ships to the browser. There is no `"use client"` ever
// allowed in a file that touches this module.
//
// Lazy + memoised so:
//   - missing env vars don't crash on import (only on actual use)
//   - we don't carry construction cost when the route doesn't need it

let cached: ReturnType<typeof createClient> | null = null;

export function createServiceClient() {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Supabase service client misconfigured: SUPABASE_SERVICE_ROLE_KEY (and NEXT_PUBLIC_SUPABASE_URL) must be set.",
    );
  }

  cached = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return cached;
}
