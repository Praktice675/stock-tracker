"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export default function Nav() {
  const router = useRouter();
  const supabase = createClient();

  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState<User | null>(null);

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

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      },
    );
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.refresh();
  }

  return (
    <nav className={`pulse-nav${scrolled ? " scrolled" : ""}`}>
      <Link href="/" className="pulse-nav__logo" aria-label="Pulse home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logos/pulse-lockup.svg"
          alt="Pulse"
          height={24}
          style={{ display: "block", height: 24, width: "auto" }}
        />
      </Link>
      <div className="pulse-nav__right">
        {user ? (
          <>
            <span className="pulse-nav__email" title={user.email ?? undefined}>
              {user.email}
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              className="pulse-nav__signout"
            >
              SIGN OUT
            </button>
          </>
        ) : (
          <>
            <Link href="/auth/login" className="pulse-nav__signin">
              SIGN IN
            </Link>
            <Link href="/auth/signup" className="pulse-nav__cta">
              LAUNCH APP →
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
