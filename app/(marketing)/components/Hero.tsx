"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

const WORD = "PULSE";

export default function Hero() {
  const heroRef = useRef<HTMLElement>(null);
  const [scrollHidden, setScrollHidden] = useState(false);

  useGSAP(
    () => {
      gsap.from(".letter", {
        yPercent: 110,
        rotate: 6,
        duration: 0.8,
        stagger: 0.03,
        ease: "expo.out",
        delay: 0.2,
      });
      gsap.from(".hero-subline", {
        y: 20,
        opacity: 0,
        duration: 0.9,
        delay: 1.4,
        ease: "power2.out",
      });
      gsap.from(".hero-cta", {
        y: 20,
        opacity: 0,
        duration: 0.9,
        delay: 1.6,
        ease: "power2.out",
      });
    },
    { scope: heroRef }
  );

  useEffect(() => {
    let raf = 0;
    let pending = false;
    const onScroll = () => {
      if (pending) return;
      pending = true;
      raf = requestAnimationFrame(() => {
        setScrollHidden(window.scrollY > 100);
        pending = false;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section className="pulse-hero" ref={heroRef}>
      <h1 className="pulse-hero__word" aria-label={WORD}>
        {WORD.split("").map((char, i) => (
          <span key={i} className="letter-mask" aria-hidden="true">
            <span className="letter">{char}</span>
          </span>
        ))}
      </h1>

      <p className="pulse-hero__tagline hero-subline">
        REAL-TIME MARKETS · PROFESSIONAL GRADE
      </p>

      <Link href="/dashboard" className="pulse-hero__cta hero-cta">
        LAUNCH TERMINAL →
      </Link>

      <div
        className="pulse-hero__scroll"
        aria-hidden="true"
        style={{
          opacity: scrollHidden ? 0 : 1,
          transition: "opacity 200ms ease",
          pointerEvents: scrollHidden ? "none" : "auto",
        }}
      >
        <span className="pulse-hero__scroll-label">SCROLL</span>
        <span className="pulse-hero__scroll-line" />
      </div>
    </section>
  );
}
