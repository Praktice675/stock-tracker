// components/ui/Card.tsx
//
// Reusable card container. Wraps section content with the standard Pulse
// card aesthetic — surface background, subtle border, rounded corners.
// Use `padding` prop to override the default 24px; pass "0" for tables
// that want to manage their own row padding. Set `hoverable` to opt in to
// the Chainx-style lift-on-hover (uses framer-motion).

"use client";

import { motion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  padding?: string;
  hoverable?: boolean;
};

export default function Card({
  children,
  className = "",
  style,
  padding = "24px",
  hoverable = false,
}: Props) {
  const baseStyle: CSSProperties = {
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderRadius: "12px",
    padding,
    ...style,
  };

  if (hoverable) {
    return (
      <motion.div
        className={className}
        style={baseStyle}
        whileHover={{
          y: -4,
          boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
          transition: { duration: 0.15 },
        }}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div className={className} style={baseStyle}>
      {children}
    </div>
  );
}
