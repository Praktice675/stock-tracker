"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Newspaper,
  PieChart,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import ChatLauncher from "@/components/chat/ChatLauncher";
import { useChatContext } from "@/components/chat/ChatProvider";
import { createClient } from "@/lib/supabase/client";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

const NAV: NavItem[] = [
  { label: "Markets", href: "/dashboard", icon: TrendingUp },
  { label: "Portfolio", href: "/dashboard/portfolio", icon: PieChart },
  { label: "News", href: "/dashboard/news", icon: Newspaper },
];

export default function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { email } = useChatContext();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
  }

  return (
    <aside className="dashboard-sidebar">
      <Link href="/dashboard" className="dashboard-sidebar__brand">
        <span className="live-dot dashboard-sidebar__dot" aria-hidden="true" />
        Pulse
      </Link>

      <nav className="dashboard-sidebar__nav" aria-label="Primary">
        {NAV.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="sidebar-item"
              data-active={active || undefined}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={16} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="dashboard-sidebar__bottom">
        <ChatLauncher />

        <div className="dashboard-sidebar__user">
          {email && (
            <span
              className="dashboard-sidebar__email"
              title={email}
            >
              {email}
            </span>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            className="dashboard-sidebar__signout"
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
