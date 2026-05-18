"use client";

import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";

type Props = {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
};

// Animates from 0 → value on mount. Subsequent value changes snap (no replay
// of the 0→N intro) so live-poll updates don't re-animate every 30s.
export default function CountUp({
  value,
  prefix = "$",
  suffix = "",
  decimals = 2,
  duration = 1.2,
  className,
}: Props) {
  const count = useMotionValue(0);
  const display = useTransform(
    count,
    (v) =>
      `${prefix}${v.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}${suffix}`,
  );
  const animatedOnceRef = useRef(false);

  useEffect(() => {
    if (!animatedOnceRef.current) {
      animatedOnceRef.current = true;
      const controls = animate(count, value, { duration, ease: "easeOut" });
      return controls.stop;
    }
    // Subsequent updates: snap, no re-animation.
    count.set(value);
    return undefined;
  }, [value, count, duration]);

  return <motion.span className={className}>{display}</motion.span>;
}
