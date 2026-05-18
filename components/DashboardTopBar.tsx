"use client";

import { usePathname } from "next/navigation";

function pageTitle(pathname: string): string {
  if (pathname.startsWith("/dashboard/portfolio")) return "Portfolio";
  if (pathname.startsWith("/dashboard/news")) return "News";
  return "Markets";
}

// Minimal top bar — page label on the left, room on the right for future
// search / notifications. Sits below the indices marquee, above the page body.
export default function DashboardTopBar() {
  const pathname = usePathname();
  return (
    <div className="dashboard-topbar">
      <span className="dashboard-topbar__title">{pageTitle(pathname)}</span>
    </div>
  );
}
