"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type ChatContextValue = {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
  userId: string;
  email: string | null;
};

const ChatContext = createContext<ChatContextValue | null>(null);

type Props = {
  userId: string;
  email: string | null;
  children: ReactNode;
};

// Lifts the chat panel's open/closed state out of the launcher so the sidebar
// button (one place) and the panel mount (another place) can share it.
export function ChatProvider({ userId, email, children }: Props) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  return (
    <ChatContext.Provider value={{ open, setOpen, toggle, userId, email }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error("useChatContext must be used inside <ChatProvider>");
  }
  return ctx;
}
