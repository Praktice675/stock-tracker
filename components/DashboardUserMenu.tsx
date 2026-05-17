"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  email: string | null;
};

// Email + SIGN OUT, styled to sit inside the orange chrome header. Black-on-
// orange to match the PULSE wordmark; the bright-white tabs are the only
// elements that pop out, which keeps the active section unambiguous.
export default function DashboardUserMenu({ email }: Props) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
  }

  return (
    <div className="flex items-center" style={{ gap: "16px" }}>
      {email && (
        <span
          className="font-mono"
          style={{
            fontSize: "11px",
            letterSpacing: "0.04em",
            color: "rgba(0, 0, 0, 0.7)",
            maxWidth: "220px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={email}
        >
          {email}
        </span>
      )}
      <button
        type="button"
        onClick={handleSignOut}
        className="font-mono font-semibold uppercase transition-opacity duration-150 hover:opacity-100"
        style={{
          fontSize: "11px",
          letterSpacing: "0.18em",
          color: "rgb(var(--color-black))",
          opacity: 0.7,
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
      >
        SIGN OUT
      </button>
    </div>
  );
}
