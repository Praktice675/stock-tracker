"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let raf = 0;
    let pending = false;
    const onScroll = () => {
      if (pending) return;
      pending = true;
      raf = requestAnimationFrame(() => {
        setScrolled(window.scrollY > 50);
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
    <nav className={`pulse-nav${scrolled ? " scrolled" : ""}`}>
      <Link href="/landing" className="pulse-nav__logo">
        PULSE
      </Link>
      <div className="pulse-nav__right">
        <a href="#" className="pulse-nav__signin">
          SIGN IN
        </a>
        <Link href="/" className="pulse-nav__cta">
          LAUNCH APP →
        </Link>
      </div>
    </nav>
  );
}
