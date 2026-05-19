import type { User } from "@supabase/supabase-js";
import { ChatProvider } from "@/components/chat/ChatProvider";
import ChatPanelMount from "@/components/chat/ChatPanelMount";
import DashboardNavbar from "@/components/DashboardNavbar";
import DashboardSidebar from "@/components/DashboardSidebar";
import DashboardTopBar from "@/components/DashboardTopBar";
import EarningsStrip from "@/components/EarningsStrip";
import { SidebarStateProvider } from "@/components/SidebarStateContext";
import { getUserPlan } from "@/lib/subscription";
import { getUserProfile } from "@/lib/user-profile";

type Props = {
  user: User;
  children: React.ReactNode;
};

// Phase D Step 3 layout: rich top navbar (ticker pills + search + profile)
// replaces the old indices marquee. Sidebar + main column underneath.
// Main column = top bar + earnings strip + page body. Chat panel mounts at the
// chrome root so the sidebar button can toggle a globally-rendered overlay.
//
// As of Phase D Step 7 the chrome also resolves the user's display name +
// avatar from user_profiles (server-side) and threads them into the navbar
// pill and sidebar profile widget so a single fetch feeds both surfaces.
// router.refresh() from the settings form re-runs this and re-renders both.
export default async function DashboardChrome({ user, children }: Props) {
  const [profile, plan] = await Promise.all([
    getUserProfile(),
    getUserPlan(),
  ]);
  const displayName =
    profile?.displayName ?? user.email?.split("@")[0] ?? "User";
  const avatarUrl = profile?.avatarUrl ?? null;
  const isPlus = plan.plan === "plus";

  return (
    <ChatProvider userId={user.id} email={user.email ?? null}>
      <SidebarStateProvider>
        {/* No bg-bg-primary on the root — body's radial-gradient backdrop
            shows through. Chrome strips/sidebar are transparent too. */}
        <div className="flex h-screen w-screen flex-col overflow-hidden text-text-primary">
          <DashboardNavbar
            user={user}
            displayName={displayName}
            avatarUrl={avatarUrl}
          />
          <div className="flex flex-1 overflow-hidden">
            <DashboardSidebar
              displayName={displayName}
              avatarUrl={avatarUrl}
              isPlus={isPlus}
            />
            <div className="flex flex-1 flex-col overflow-hidden">
              <DashboardTopBar />
              <EarningsStrip />
              <div className="flex flex-1 overflow-hidden">{children}</div>
            </div>
          </div>
          <ChatPanelMount />
          <div className="narrow-viewport-notice" role="status">
            Best viewed on desktop.
          </div>
        </div>
      </SidebarStateProvider>
    </ChatProvider>
  );
}
