import { redirect } from "next/navigation";
import DashboardChrome from "@/components/DashboardChrome";
import AccountSettingsForm from "@/components/settings/AccountSettingsForm";
import { getUserProfile } from "@/lib/user-profile";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SECTIONS = [{ key: "account", label: "Account" }] as const;

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login");
  }

  const profile = await getUserProfile();
  if (!profile) {
    redirect("/auth/login");
  }

  const activeSection = "account";

  return (
    <DashboardChrome user={user}>
      <div
        className="flex w-full flex-col overflow-y-auto"
        style={{ padding: "24px 24px 48px" }}
      >
        <div style={{ marginBottom: "24px" }}>
          <h1
            style={{
              fontSize: "28px",
              fontWeight: 700,
              color: "var(--text-primary)",
              margin: 0,
              marginBottom: "6px",
              letterSpacing: "-0.015em",
            }}
          >
            Settings
          </h1>
          <p
            style={{
              fontSize: "14px",
              color: "var(--text-muted)",
              margin: 0,
            }}
          >
            Manage your Pulse account.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "200px minmax(0, 1fr)",
            gap: "24px",
            alignItems: "start",
          }}
        >
          <nav
            aria-label="Settings sections"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "2px",
            }}
          >
            {SECTIONS.map((s) => {
              const isActive = s.key === activeSection;
              return (
                <div
                  key={s.key}
                  data-active={isActive || undefined}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: isActive
                      ? "var(--text-primary)"
                      : "var(--text-muted)",
                    background: isActive
                      ? "var(--bg-elevated)"
                      : "transparent",
                    cursor: isActive ? "default" : "pointer",
                  }}
                >
                  {s.label}
                </div>
              );
            })}
          </nav>

          <AccountSettingsForm
            initialName={profile.displayName}
            initialAvatarUrl={profile.avatarUrl}
            email={profile.email ?? ""}
          />
        </div>
      </div>
    </DashboardChrome>
  );
}
