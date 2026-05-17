import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import ChatLauncher from "@/components/chat/ChatLauncher";
import DashboardTabs from "@/components/DashboardTabs";
import DashboardUserMenu from "@/components/DashboardUserMenu";
import EarningsStrip from "@/components/EarningsStrip";
import IndicesStrip from "@/components/IndicesStrip";

type Props = {
  user: User;
  children: React.ReactNode;
};

// Orange brand bar → earnings strip → body. Tabs and user menu live inline
// inside the bar; the standalone tab strip from Phase 1 is gone.
export default function DashboardChrome({ user, children }: Props) {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-bg-primary text-text-primary">
      <ChromeHeader email={user.email ?? null} />
      <EarningsStrip />
      <div className="flex flex-1 overflow-hidden">{children}</div>
      <ChatLauncher />
    </div>
  );
}

function ChromeHeader({ email }: { email: string | null }) {
  return (
    <header
      className="flex h-[65px] w-full shrink-0 items-center justify-between px-6"
      style={{
        backgroundColor: "rgb(var(--color-orange))",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center" style={{ gap: "32px" }}>
        <Link
          href="/"
          className="font-mono font-bold uppercase no-underline transition-opacity hover:opacity-70"
          style={{
            fontSize: "11px",
            letterSpacing: "0.3em",
            color: "rgb(var(--color-black))",
          }}
        >
          ← Pulse
        </Link>
        <DashboardTabs />
      </div>

      <div className="flex items-center" style={{ gap: "24px" }}>
        <IndicesStrip />
        <DashboardUserMenu email={email} />
      </div>
    </header>
  );
}
