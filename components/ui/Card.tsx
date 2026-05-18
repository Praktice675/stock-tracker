// components/ui/Card.tsx
//
// Reusable card container. Wraps section content with the standard Pulse
// card aesthetic — surface background, subtle border, rounded corners.
// Use `padding` prop to override the default 24px; pass "0" for tables
// that want to manage their own row padding.

import type { CSSProperties, ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  padding?: string;
};

export default function Card({
  children,
  className = "",
  style,
  padding = "24px",
}: Props) {
  return (
    <div
      className={className}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        padding,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
