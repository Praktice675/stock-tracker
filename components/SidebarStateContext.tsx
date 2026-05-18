"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const COLLAPSE_KEY = "pulse-sidebar-collapsed";

type SidebarState = {
  collapsed: boolean;
  toggleCollapsed: () => void;
};

const SidebarStateContext = createContext<SidebarState | null>(null);

export function SidebarStateProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(COLLAPSE_KEY);
      if (raw === "true") setCollapsed(true);
    } catch {
      /* localStorage unavailable — accept default */
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, String(next));
      } catch {
        /* persistence is best-effort */
      }
      return next;
    });
  }, []);

  return (
    <SidebarStateContext.Provider value={{ collapsed, toggleCollapsed }}>
      {children}
    </SidebarStateContext.Provider>
  );
}

export function useSidebarState(): SidebarState {
  const ctx = useContext(SidebarStateContext);
  if (!ctx) {
    throw new Error(
      "useSidebarState must be used within a SidebarStateProvider",
    );
  }
  return ctx;
}
