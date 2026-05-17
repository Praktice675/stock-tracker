"use client";

import { useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger);

const SMALL_STATS = [
  { value: "170+", label: "Stocks tracked live" },
  { value: "30s", label: "Refresh interval" },
  { value: "3", label: "Data sources" },
];

export default function BigStat() {
  const bigStatRef = useRef<HTMLElement>(null);
  const counter = useRef({ val: 0 });
  const [displayed, setDisplayed] = useState("0.0");

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(min-width: 768px)", () => {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: bigStatRef.current,
            start: "top top",
            end: "+=80%",
            pin: true,
            scrub: 0.5,
          },
        });

        tl.to(
          counter.current,
          {
            val: 2.4,
            duration: 0.6,
            ease: "none",
            onUpdate: () =>
              setDisplayed(counter.current.val.toFixed(1)),
          },
          0
        );

        tl.from(
          ".bigstat-cell",
          {
            y: 30,
            opacity: 0,
            stagger: 0.1,
            duration: 0.2,
            ease: "power2.out",
          },
          0.7
        );
      });

      mm.add("(max-width: 767px)", () => {
        // Mobile: no pin. Run counter and small-stats reveal on enter.
        gsap.to(counter.current, {
          val: 2.4,
          duration: 1.6,
          ease: "power2.out",
          onUpdate: () =>
            setDisplayed(counter.current.val.toFixed(1)),
          scrollTrigger: {
            trigger: bigStatRef.current,
            start: "top 75%",
            once: true,
          },
        });

        gsap.from(".bigstat-cell", {
          y: 30,
          opacity: 0,
          stagger: 0.1,
          duration: 0.7,
          ease: "power2.out",
          scrollTrigger: {
            trigger: bigStatRef.current,
            start: "top 60%",
          },
        });
      });
    },
    { scope: bigStatRef }
  );

  return (
    <section className="pulse-bigstat" ref={bigStatRef}>
      <span className="pulse-bigstat__label">MARKET COVERAGE</span>
      <p className="pulse-bigstat__number">${displayed}T</p>
      <p className="pulse-bigstat__caption">
        Tracked across global markets every day
      </p>

      <div className="pulse-bigstat__row">
        {SMALL_STATS.map((s) => (
          <div className="pulse-bigstat__cell bigstat-cell" key={s.label}>
            <span className="pulse-bigstat__value">{s.value}</span>
            <span className="pulse-bigstat__cell-label">{s.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
