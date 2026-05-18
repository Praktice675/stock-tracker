import type { User } from "@supabase/supabase-js";
import { ChatProvider } from "@/components/chat/ChatProvider";
import ChatPanelMount from "@/components/chat/ChatPanelMount";
import DashboardSidebar from "@/components/DashboardSidebar";
import DashboardTopBar from "@/components/DashboardTopBar";
import EarningsStrip from "@/components/EarningsStrip";
import IndicesStrip from "@/components/IndicesStrip";

type Props = {
  user: User;
  children: React.ReactNode;
};

// Phase A layout: indices marquee (full width) → row of sidebar + main column.
// Main column = top bar + earnings strip + page body. Chat panel mounts at the
// chrome root so the sidebar button can toggle a globally-rendered overlay.
export default function DashboardChrome({ user, children }: Props) {
  return (
    <ChatProvider userId={user.id} email={user.email ?? null}>
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-bg-primary text-text-primary">
        <IndicesStrip />
        <div className="flex flex-1 overflow-hidden">
          <DashboardSidebar />
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
    </ChatProvider>
  );
}
