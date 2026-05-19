import { createClient } from "@/lib/supabase/server";

export type PlanInfo = {
  plan: "free" | "plus";
  status: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

export async function getUserPlan(): Promise<PlanInfo> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      plan: "free",
      status: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    };
  }
  const { data } = await supabase
    .from("subscriptions")
    .select("plan, status, current_period_end, cancel_at_period_end")
    .eq("user_id", user.id)
    .maybeSingle();
  return {
    plan: (data?.plan as "free" | "plus") ?? "free",
    status: data?.status ?? null,
    currentPeriodEnd: data?.current_period_end ?? null,
    cancelAtPeriodEnd: data?.cancel_at_period_end ?? false,
  };
}
