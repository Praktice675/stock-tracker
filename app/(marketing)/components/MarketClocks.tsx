"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger);

type Market = {
  code: string;
  timeZone: string;
  openHour: number;
  closeHour: number;
};

const MARKETS: Market[] = [
  { code: "NYSE", timeZone: "America/New_York", openHour: 9.5, closeHour: 16 },
  { code: "NASDAQ", timeZone: "America/New_York", openHour: 9.5, closeHour: 16 },
  { code: "LSE", timeZone: "Europe/London", openHour: 8, closeHour: 16.5 },
  { code: "TSE", timeZone: "Asia/Tokyo", openHour: 9, closeHour: 15 },
];

type Parts = {
  hh: string;
  mm: string;
  rawSeconds: number;
  decimalHours: number;
};

function getParts(timeZone: string, now: Date): Parts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = fmt.formatToParts(now);
  const lookup: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") lookup[p.type] = p.value;
  }
  const hh = lookup.hour === "24" ? "00" : lookup.hour ?? "00";
  const mm = lookup.minute ?? "00";
  const ss = lookup.second ?? "00";
  const rawSeconds = Number(ss);
  const decimalHours = Number(hh) + Number(mm) / 60 + rawSeconds / 3600;
  return { hh, mm, rawSeconds, decimalHours };
}

function isOpen(market: Market, decimalHours: number) {
  return decimalHours >= market.openHour && decimalHours < market.closeHour;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export default function MarketClocks() {
  const ref = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [scrollOffset, setScrollOffset] = useState(0);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useGSAP(
    () => {
      ScrollTrigger.create({
        trigger: document.body,
        start: "top top",
        end: "+=100vh",
        onUpdate: (self) => setScrollOffset(Math.floor(self.progress * 60)),
      });
    },
    { scope: ref }
  );

  return (
    <div
      className="pulse-clocks"
      role="region"
      aria-label="Market clocks"
      ref={ref}
    >
      {MARKETS.map((m) => {
        const parts = now ? getParts(m.timeZone, now) : null;
        const open = parts ? isOpen(m, parts.decimalHours) : false;
        const displaySeconds = parts
          ? (parts.rawSeconds + scrollOffset) % 60
          : 0;
        return (
          <div className="pulse-clock" key={m.code}>
            <span className="pulse-clock__code">{m.code}</span>
            <span className="pulse-clock__time">
              {parts
                ? `${parts.hh}:${parts.mm}:${pad(displaySeconds)}`
                : "--:--:--"}
            </span>
            <span
              className={`pulse-clock__status ${
                open
                  ? "pulse-clock__status--open"
                  : "pulse-clock__status--closed"
              }`}
            >
              <span className="pulse-clock__dot" />
              {open ? "OPEN" : "CLOSED"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
