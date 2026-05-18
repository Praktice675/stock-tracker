"use client";

import { MessageSquare } from "lucide-react";
import { useChatContext } from "./ChatProvider";

// Sidebar entry that toggles the global ChatPanel. The floating bottom-right
// circle is gone — ChatPanel mounting moved to <ChatPanelMount /> at the chrome
// root, and this button just flips a shared context flag.
export default function ChatLauncher() {
  const { open, toggle } = useChatContext();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={open ? "Close Pulse Assistant" : "Open Pulse Assistant"}
      aria-expanded={open}
      className="sidebar-item"
      data-active={open || undefined}
    >
      <MessageSquare size={16} aria-hidden="true" />
      <span>Ask Pulse</span>
    </button>
  );
}
