"use client";

import { useEffect, useState } from "react";
import { MessageSquare, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ChatPanel from "./ChatPanel";

// Floating circle in the bottom-right of every dashboard page. Only visible
// when there's an authenticated Supabase user — the launcher checks itself,
// and DashboardChrome scopes its mounting to /dashboard/* anyway.
export default function ChatLauncher() {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      setUserId(data.user?.id ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUserId(session?.user?.id ?? null);
      },
    );

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (!userId) return null;

  return (
    <>
      {open && (
        <ChatPanel userId={userId} onClose={() => setOpen(false)} />
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close Pulse Assistant" : "Open Pulse Assistant"}
        aria-expanded={open}
        className="chat-launcher"
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 50,
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          backgroundColor: "#FF6B1A",
          color: "rgb(var(--color-black))",
          border: "1px solid #FF8C4A",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "transform 200ms ease, filter 200ms ease",
        }}
      >
        {open ? <X size={22} /> : <MessageSquare size={22} />}
      </button>
    </>
  );
}
