"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "MARKETS", href: "/dashboard" },
  { label: "PORTFOLIO", href: "/dashboard/portfolio" },
  { label: "NEWS", href: "/dashboard/news" },
] as const;

// Renders the three top-level dashboard tabs as plain text links sitting
// inline inside the orange chrome header. No background, no underline, no
// border — color alone differentiates active from inactive.
export default function DashboardTabs() {
  const pathname = usePathname();

  return (
    <nav
      className="flex items-center"
      style={{ gap: "24px" }}
      aria-label="Dashboard sections"
    >
      {TABS.map((t) => {
        const active =
          t.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={
              "font-mono font-semibold uppercase no-underline transition-colors duration-150 ease-brand " +
              (active ? "text-white" : "text-white/60 hover:text-white")
            }
            style={{ fontSize: "13px", letterSpacing: "0.22em" }}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
