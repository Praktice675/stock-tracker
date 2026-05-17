"use client";

import { useRef } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger);

const HEADLINE_LINES = ["Start tracking your", "portfolio today."];

export default function CTA() {
  const ctaRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.from(".cta-line", {
        yPercent: 110,
        stagger: 0.15,
        duration: 1.2,
        ease: "expo.out",
        scrollTrigger: {
          trigger: ctaRef.current,
          start: "top 70%",
        },
      });
      gsap.from(".cta-subline", {
        y: 20,
        opacity: 0,
        duration: 0.8,
        delay: 0.4,
        ease: "power2.out",
        scrollTrigger: {
          trigger: ctaRef.current,
          start: "top 70%",
        },
      });
      gsap.from(".cta-button", {
        y: 20,
        opacity: 0,
        duration: 0.8,
        delay: 0.6,
        ease: "power2.out",
        scrollTrigger: {
          trigger: ctaRef.current,
          start: "top 70%",
        },
      });
    },
    { scope: ctaRef }
  );

  return (
    <section className="pulse-cta" ref={ctaRef}>
      <h2 className="pulse-cta__headline">
        {HEADLINE_LINES.map((line, i) => (
          <span className="cta-line-mask" key={i}>
            <span className="cta-line">{line}</span>
          </span>
        ))}
      </h2>
      <p className="pulse-cta__sub cta-subline">Join traders using Pulse.</p>
      <Link href="/dashboard" className="pulse-cta__btn cta-button">
        LAUNCH TERMINAL →
      </Link>
    </section>
  );
}
