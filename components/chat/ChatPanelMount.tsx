"use client";

import ChatPanel from "./ChatPanel";
import { useChatContext } from "./ChatProvider";

// Mounted once at the chrome root. Renders the floating panel when context.open
// is true. Panel positioning (fixed bottom-right) is unchanged from before.
export default function ChatPanelMount() {
  const { open, userId, setOpen } = useChatContext();
  if (!open) return null;
  return <ChatPanel userId={userId} onClose={() => setOpen(false)} />;
}
