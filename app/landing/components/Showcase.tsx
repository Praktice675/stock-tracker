"use client";

import { Fragment, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger);

const W = 1000;
const H = 320;

type P = { x: number; y: number };
const points: P[] = [
  { x: 0, y: 0.2 },
  { x: 0.125, y: 0.28 },
  { x: 0.25, y: 0.35 },
  { x: 0.375, y: 0.4 },
  { x: 0.4, y: 0.45 },
  { x: 0.55, y: 0.35 },
  { x: 0.75, y: 0.25 },
  { x: 1, y: 0.15 },
].map((p) => ({ x: p.x * W, y: p.y * H }));

function buildPath(pts: P[]): string {
  if (pts.length === 0) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

const HEADLINE_WORDS = "Everything you need to trade smarter.".split(" ");

export default function Showcase() {
  const showcaseRef = useRef<HTMLElement>(null);
  const pathRef = useRef<SVGPathElement>(null);

  const linePath = buildPath(points);
  const areaPath = `${linePath} L ${W} ${H} L 0 ${H} Z`;

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(min-width: 768px)", () => {
        // Pre-stage chart path for stroke draw-on
        if (pathRef.current) {
          const len = pathRef.current.getTotalLength();
          gsap.set(pathRef.current, {
            strokeDasharray: len,
            strokeDashoffset: len,
          });
        }

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: showcaseRef.current,
            start: "top top",
            end: "+=100%",
            pin: true,
            scrub: true,
          },
        });

        tl.from(
          ".showcase-word",
          {
            yPercent: 110,
            stagger: 0.1,
            ease: "power3.out",
            duration: 0.4,
          },
          0
        );
        tl.from(
          ".showcase-subtext",
          {
            y: 20,
            opacity: 0,
            duration: 0.3,
          },
          0.3
        );
        tl.from(
          ".showcase-card",
          {
            y: 80,
            scale: 0.92,
            opacity: 0,
            duration: 0.4,
          },
          0.4
        );
        tl.to(
          ".showcase-chart-path",
          {
            strokeDashoffset: 0,
            duration: 0.35,
            ease: "none",
          },
          0.5
        );
        tl.from(
          ".showcase-pill",
          {
            y: 20,
            opacity: 0,
            stagger: 0.1,
            duration: 0.2,
          },
          0.8
        );
      });

      mm.add("(max-width: 767px)", () => {
        // Mobile: simple enter-viewport fade-ups, no pin/scrub.
        if (pathRef.current) {
          // Make sure the chart is fully visible on mobile.
          gsap.set(pathRef.current, {
            strokeDasharray: "none",
            strokeDashoffset: 0,
          });
        }
        gsap.from(".showcase-word", {
          yPercent: 110,
          stagger: 0.05,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: {
            trigger: showcaseRef.current,
            start: "top 80%",
          },
        });
        gsap.from(
          [".showcase-subtext", ".showcase-card", ".showcase-pill"],
          {
            y: 24,
            opacity: 0,
            stagger: 0.08,
            duration: 0.7,
            ease: "power2.out",
            scrollTrigger: {
              trigger: showcaseRef.current,
              start: "top 75%",
            },
          }
        );
      });
    },
    { scope: showcaseRef }
  );

  return (
    <section className="pulse-showcase" ref={showcaseRef}>
      <span className="pulse-section-label">THE TERMINAL</span>
      <h2 className="pulse-showcase__headline">
        {HEADLINE_WORDS.map((w, i) => (
          <Fragment key={i}>
            <span className="showcase-word-mask">
              <span className="showcase-word">{w}</span>
            </span>
            {i < HEADLINE_WORDS.length - 1 ? " " : ""}
          </Fragment>
        ))}
      </h2>
      <p className="pulse-showcase__subtext showcase-subtext">
        Real-time prices. Professional charts. Portfolio tracking. All in one
        place.
      </p>

      <div className="pulse-showcase__card showcase-card">
        <svg
          className="pulse-showcase__chart"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label="Sample upward trending chart"
        >
          <defs>
            <linearGradient id="pulse-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,107,26,0.2)" />
              <stop offset="100%" stopColor="rgba(255,107,26,0)" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#pulse-area)" />
          <path
            ref={pathRef}
            className="showcase-chart-path"
            d={linePath}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <div className="pulse-showcase__pills">
          <span className="pulse-pill showcase-pill">
            <span className="pulse-pill__ticker">AAPL</span>
            <span className="pulse-pill__price">$300.23</span>
            <span className="pulse-pill__change">+0.68%</span>
          </span>
          <span className="pulse-pill showcase-pill">
            <span className="pulse-pill__ticker">NVDA</span>
            <span className="pulse-pill__price">$186.00</span>
            <span className="pulse-pill__change">+0.43%</span>
          </span>
          <span className="pulse-pill showcase-pill">
            <span className="pulse-pill__ticker">SPY</span>
            <span className="pulse-pill__price">$521.88</span>
            <span className="pulse-pill__change">+0.43%</span>
          </span>
        </div>
      </div>
    </section>
  );
}
