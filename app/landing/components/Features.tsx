"use client";

import { useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger);

type Feature = { num: string; name: string; desc: string };

const FEATURES: Feature[] = [
  {
    num: "01",
    name: "Real-Time Data",
    desc: "Live prices, candlestick charts, and volume powered by Yahoo Finance. No delays.",
  },
  {
    num: "02",
    name: "Portfolio Tracking",
    desc: "Add positions and watch your P&L update live. Know exactly where you stand.",
  },
  {
    num: "03",
    name: "Professional Charts",
    desc: "TradingView-grade candlesticks with volume bars and timeframe controls. Built for serious traders.",
  },
];

export default function Features() {
  const featuresRef = useRef<HTMLElement>(null);
  const [activeFeature, setActiveFeature] = useState(0);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(min-width: 768px)", () => {
        ScrollTrigger.create({
          trigger: featuresRef.current,
          start: "top top",
          end: "+=120%",
          pin: true,
          scrub: true,
          onUpdate: (self) => {
            const i = Math.min(2, Math.floor(self.progress * 3));
            setActiveFeature(i);
          },
        });
      });

      mm.add("(max-width: 767px)", () => {
        // Mobile: no pin/scrub. Just keep everything visible and reveal on enter.
        gsap.from(".pulse-feature", {
          y: 40,
          opacity: 0,
          stagger: 0.15,
          duration: 0.8,
          ease: "power2.out",
          scrollTrigger: {
            trigger: featuresRef.current,
            start: "top 75%",
          },
        });
      });
    },
    { scope: featuresRef }
  );

  return (
    <section className="pulse-features" ref={featuresRef}>
      <span className="pulse-features__label">WHY PULSE</span>
      <div className="pulse-features__grid">
        {FEATURES.map((f, i) => (
          <div
            className={`pulse-feature${
              i === activeFeature ? " pulse-feature--active" : ""
            }`}
            key={f.num}
          >
            <div className="pulse-feature__num">{f.num}</div>
            <div className="pulse-feature__rule" />
            <h3 className="pulse-feature__name">{f.name}</h3>
            <p className="pulse-feature__desc">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
