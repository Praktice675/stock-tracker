import { redirect } from "next/navigation";
import DashboardChrome from "@/components/DashboardChrome";
import { createClient } from "@/lib/supabase/server";

export default async function PortfolioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return (
    <DashboardChrome user={user}>
      <div className="flex w-full items-center justify-center" style={{ minHeight: "60vh" }}>
        <p className="text-neutral-500 text-sm uppercase tracking-wider">
          Portfolio coming soon
        </p>
      </div>
    </DashboardChrome>
  );
}
