"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

const WORD = "PULSE";

// Brand colors.
const ACCENT: [number, number, number] = [255, 107, 26]; // #ff6b3d
const GREEN: [number, number, number] = [0, 208, 132]; // #00D084
const RED: [number, number, number] = [255, 51, 85]; // #FF3355

// 17-second loop, four phases (unchanged from previous tuning pass).
const SCATTERED_END = 3000;
const FORMING_END = 7000;
const HOLDING_END = 13000;
const CYCLE_MS = 17000;
const FORMING_MS = FORMING_END - SCATTERED_END;
const DISSOLVING_MS = CYCLE_MS - HOLDING_END;

const TOTAL_PARTICLES = 200;
const BARS = 20;
const BODY_ROWS = 4;
const WICKS_PER_BAR = 2;
const TARGETS_PER_BAR = BODY_ROWS + WICKS_PER_BAR; // 6
const TARGET_COUNT = BARS * TARGETS_PER_BAR; // 120
// Drifters fill the remainder (80).

const CONNECT_DIST = 120;
const CONNECT_DIST_SQ = CONNECT_DIST * CONNECT_DIST;

type Phase = "scattered" | "forming" | "holding" | "dissolving";
type ParticleKind = "body" | "wick" | "drifter";
type WickSide = "upper" | "lower" | null;
type Direction = "up" | "down" | "neutral";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseRadius: number;
  baseAlpha: number;
  kind: ParticleKind;
  // For body/wick:
  targetX: number;
  targetY: number;
  formStartX: number;
  formStartY: number;
  barIndex: number; // -1 for drifter
  bodyRow: number; // 0..3 for body, -1 otherwise
  wickSide: WickSide; // set for wick particles
};

type BarMeta = {
  x: number;
  centerY: number;
  direction: Direction;
  color: [number, number, number];
  bodyIdxs: number[]; // 4 particle indices, row 0..3
  upperWickIdx: number;
  lowerWickIdx: number;
};

function makeRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerpColor(
  from: [number, number, number],
  to: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    Math.round(from[0] + (to[0] - from[0]) * t),
    Math.round(from[1] + (to[1] - from[1]) * t),
    Math.round(from[2] + (to[2] - from[2]) * t),
  ];
}

function rgba(c: [number, number, number], a: number): string {
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a.toFixed(3)})`;
}

// Deterministic price walk: each bar's centerY drifts ±3-6% of height from
// the previous, clamped to [25%, 75%]. Movement direction colors the candle.
type LayoutTarget = {
  x: number;
  y: number;
  kind: "body" | "wick";
  barIndex: number;
  bodyRow: number;
  wickSide: WickSide;
};

function computeLayout(width: number, height: number) {
  const rng = makeRng(1337);
  const margin = Math.max(24, width * 0.04);
  const usable = width - margin * 2;
  const stride = usable / BARS;
  const cyMin = height * 0.25;
  const cyMax = height * 0.75;

  const baseInfo: {
    x: number;
    centerY: number;
    bodyHeight: number;
    direction: Direction;
    color: [number, number, number];
  }[] = [];

  let centerY = height * 0.5;
  for (let b = 0; b < BARS; b++) {
    let direction: Direction = "neutral";
    if (b > 0) {
      const sign = rng() < 0.5 ? -1 : 1;
      const magnitude = (0.03 + rng() * 0.03) * height; // 3-6%
      const proposed = centerY + sign * magnitude;
      const clamped = Math.max(cyMin, Math.min(cyMax, proposed));
      const dy = clamped - centerY;
      // y decreasing on screen = price up (green); y increasing = price down (red).
      if (dy < -0.5) direction = "up";
      else if (dy > 0.5) direction = "down";
      else direction = "neutral";
      centerY = clamped;
    }
    const bodyHeight = (0.2 + rng() * 0.2) * height; // 20-40%
    const color =
      direction === "up" ? GREEN : direction === "down" ? RED : ACCENT;
    baseInfo.push({
      x: margin + stride * (b + 0.5),
      centerY,
      bodyHeight,
      direction,
      color,
    });
  }

  // Per bar, emit 6 targets in stable order: row0, row1, row2, row3, upper wick, lower wick.
  const targets: LayoutTarget[] = [];
  for (let b = 0; b < BARS; b++) {
    const bar = baseInfo[b];
    const top = bar.centerY - bar.bodyHeight / 2;
    const bottom = bar.centerY + bar.bodyHeight / 2;
    for (let r = 0; r < BODY_ROWS; r++) {
      const t = r / (BODY_ROWS - 1);
      targets.push({
        x: bar.x,
        y: top + (bottom - top) * t,
        kind: "body",
        barIndex: b,
        bodyRow: r,
        wickSide: null,
      });
    }
    const wickOffset = bar.bodyHeight * 0.3;
    targets.push({
      x: bar.x,
      y: top - wickOffset,
      kind: "wick",
      barIndex: b,
      bodyRow: -1,
      wickSide: "upper",
    });
    targets.push({
      x: bar.x,
      y: bottom + wickOffset,
      kind: "wick",
      barIndex: b,
      bodyRow: -1,
      wickSide: "lower",
    });
  }

  return { baseInfo, targets };
}

function initParticles(width: number, height: number): Particle[] {
  const rng = makeRng(7);
  const particles: Particle[] = [];
  for (let i = 0; i < TOTAL_PARTICLES; i++) {
    let kind: ParticleKind;
    if (i < TARGET_COUNT) {
      // Within each bar (6 particles): first 4 body, then 2 wick.
      const within = i % TARGETS_PER_BAR;
      kind = within < BODY_ROWS ? "body" : "wick";
    } else {
      kind = "drifter";
    }
    const baseRadius = kind === "body" ? 2.5 : 2;
    const baseAlpha = kind === "drifter" ? 0.4 : kind === "body" ? 0.6 : 0.55;
    particles.push({
      x: rng() * width,
      y: rng() * height,
      vx: (rng() - 0.5) * 0.35,
      vy: (rng() - 0.5) * 0.35,
      baseRadius,
      baseAlpha,
      kind,
      targetX: 0,
      targetY: 0,
      formStartX: 0,
      formStartY: 0,
      barIndex: -1,
      bodyRow: -1,
      wickSide: null,
    });
  }
  return particles;
}

function applyLayout(
  particles: Particle[],
  layout: ReturnType<typeof computeLayout>,
): BarMeta[] {
  const { baseInfo, targets } = layout;
  for (let i = 0; i < TARGET_COUNT && i < targets.length; i++) {
    const t = targets[i];
    const p = particles[i];
    p.targetX = t.x;
    p.targetY = t.y;
    p.barIndex = t.barIndex;
    p.bodyRow = t.bodyRow;
    p.wickSide = t.wickSide;
  }
  const bars: BarMeta[] = baseInfo.map((b, idx) => {
    const base = idx * TARGETS_PER_BAR;
    return {
      x: b.x,
      centerY: b.centerY,
      direction: b.direction,
      color: b.color,
      bodyIdxs: [base + 0, base + 1, base + 2, base + 3],
      upperWickIdx: base + 4,
      lowerWickIdx: base + 5,
    };
  });
  return bars;
}

export default function Hero() {
  const heroRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
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
    { scope: heroRef },
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

  useEffect(() => {
    const canvas = canvasRef.current;
    const section = heroRef.current;
    if (!canvas || !section) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let cssWidth = 0;
    let cssHeight = 0;
    let dpr = 1;
    let particles: Particle[] = [];
    let bars: BarMeta[] = [];

    function resizeCanvas() {
      dpr = window.devicePixelRatio || 1;
      cssWidth = section!.clientWidth;
      cssHeight = section!.clientHeight;
      canvas!.style.width = `${cssWidth}px`;
      canvas!.style.height = `${cssHeight}px`;
      canvas!.width = Math.max(1, Math.round(cssWidth * dpr));
      canvas!.height = Math.max(1, Math.round(cssHeight * dpr));
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (particles.length === 0) {
        particles = initParticles(cssWidth, cssHeight);
      } else {
        for (const p of particles) {
          if (p.x < 0) p.x = ((p.x % cssWidth) + cssWidth) % cssWidth;
          if (p.x > cssWidth) p.x = p.x % cssWidth;
          if (p.y < 0) p.y = ((p.y % cssHeight) + cssHeight) % cssHeight;
          if (p.y > cssHeight) p.y = p.y % cssHeight;
        }
      }
      bars = applyLayout(particles, computeLayout(cssWidth, cssHeight));
    }

    function drawConnections(phase: Phase) {
      const networkAlpha = phase === "holding" ? 0.08 : 0.15;
      ctx!.lineWidth = 0.5;
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distSq = dx * dx + dy * dy;
          if (distSq >= CONNECT_DIST_SQ) continue;
          const dist = Math.sqrt(distSq);
          const closeness = 1 - dist / CONNECT_DIST;
          ctx!.strokeStyle = rgba(ACCENT, networkAlpha * closeness);
          ctx!.beginPath();
          ctx!.moveTo(a.x, a.y);
          ctx!.lineTo(b.x, b.y);
          ctx!.stroke();
        }
      }
    }

    function drawChartLines(chartIntensity: number, colorIntensity: number) {
      if (chartIntensity <= 0.001) return;

      // 1. Bar bodies (color lerps from orange → bar color via colorIntensity).
      ctx!.lineWidth = 1.5;
      for (const bar of bars) {
        const c = lerpColor(ACCENT, bar.color, colorIntensity);
        ctx!.strokeStyle = rgba(c, 0.85 * chartIntensity);
        ctx!.beginPath();
        const first = particles[bar.bodyIdxs[0]];
        ctx!.moveTo(first.x, first.y);
        for (let r = 1; r < bar.bodyIdxs.length; r++) {
          const p = particles[bar.bodyIdxs[r]];
          ctx!.lineTo(p.x, p.y);
        }
        ctx!.stroke();
      }

      // 2. Wick connections: upper wick → body row 0, lower wick → body row 3.
      ctx!.lineWidth = 0.5;
      for (const bar of bars) {
        const c = lerpColor(ACCENT, bar.color, colorIntensity);
        ctx!.strokeStyle = rgba(c, 0.5 * chartIntensity);
        const upper = particles[bar.upperWickIdx];
        const top = particles[bar.bodyIdxs[0]];
        ctx!.beginPath();
        ctx!.moveTo(upper.x, upper.y);
        ctx!.lineTo(top.x, top.y);
        ctx!.stroke();
        const lower = particles[bar.lowerWickIdx];
        const bottom = particles[bar.bodyIdxs[BODY_ROWS - 1]];
        ctx!.beginPath();
        ctx!.moveTo(lower.x, lower.y);
        ctx!.lineTo(bottom.x, bottom.y);
        ctx!.stroke();
      }

      // 3. Trend line through bar centers (smooth quadratic, brand orange).
      ctx!.lineWidth = 1;
      ctx!.strokeStyle = rgba(ACCENT, 0.4 * chartIntensity);
      ctx!.beginPath();
      ctx!.moveTo(bars[0].x, bars[0].centerY);
      for (let i = 1; i < bars.length - 1; i++) {
        const midX = (bars[i].x + bars[i + 1].x) / 2;
        const midY = (bars[i].centerY + bars[i + 1].centerY) / 2;
        ctx!.quadraticCurveTo(bars[i].x, bars[i].centerY, midX, midY);
      }
      const last = bars[bars.length - 1];
      ctx!.lineTo(last.x, last.centerY);
      ctx!.stroke();
    }

    function drawParticles(dotIntensity: number, colorIntensity: number) {
      for (const p of particles) {
        // Color
        let renderColor: [number, number, number];
        if (p.kind === "drifter") {
          renderColor = ACCENT;
        } else {
          const bar = bars[p.barIndex];
          renderColor = lerpColor(ACCENT, bar.color, colorIntensity);
        }

        // Radius + alpha
        let radius: number;
        let alpha: number;
        if (p.kind === "body") {
          radius = p.baseRadius + (4 - p.baseRadius) * dotIntensity;
          alpha = p.baseAlpha + (1 - p.baseAlpha) * dotIntensity;
        } else if (p.kind === "wick") {
          radius = 2; // spec: wick stays small (2px) during hold
          alpha = p.baseAlpha + (0.7 - p.baseAlpha) * dotIntensity;
        } else {
          radius = p.baseRadius;
          alpha = p.baseAlpha;
        }

        ctx!.fillStyle = rgba(renderColor, alpha);
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    function drawFrame(
      phase: Phase,
      chartIntensity: number,
      dotIntensity: number,
      colorIntensity: number,
    ) {
      ctx!.clearRect(0, 0, cssWidth, cssHeight);
      drawConnections(phase);
      drawChartLines(chartIntensity, colorIntensity);
      drawParticles(dotIntensity, colorIntensity);
    }

    function wrap(p: Particle) {
      const m = 5;
      if (p.x < -m) p.x = cssWidth + m;
      else if (p.x > cssWidth + m) p.x = -m;
      if (p.y < -m) p.y = cssHeight + m;
      else if (p.y > cssHeight + m) p.y = -m;
    }

    function driftParticle(p: Particle, pullToCenter: boolean) {
      if (pullToCenter) {
        p.vx += (cssWidth / 2 - p.x) * 0.0000045;
        p.vy += (cssHeight / 2 - p.y) * 0.0000045;
      }
      const maxV = 0.7;
      if (p.vx > maxV) p.vx = maxV;
      else if (p.vx < -maxV) p.vx = -maxV;
      if (p.vy > maxV) p.vy = maxV;
      else if (p.vy < -maxV) p.vy = -maxV;
      p.x += p.vx;
      p.y += p.vy;
      wrap(p);
    }

    resizeCanvas();

    // --- Reduced motion: snap to holding frame, no rAF. ---
    if (prefersReducedMotion) {
      for (let i = 0; i < TARGET_COUNT; i++) {
        const p = particles[i];
        p.x = p.targetX;
        p.y = p.targetY;
      }
      drawFrame("holding", 1, 1, 1);

      const ro = new ResizeObserver(() => {
        resizeCanvas();
        for (let i = 0; i < TARGET_COUNT; i++) {
          const p = particles[i];
          p.x = p.targetX;
          p.y = p.targetY;
        }
        drawFrame("holding", 1, 1, 1);
      });
      ro.observe(section);
      return () => ro.disconnect();
    }

    // --- Animated mode ---
    let rafId = 0;
    let loopStart = performance.now();
    let savedElapsed = 0;
    let isVisible = true;
    let lastPhase: Phase | null = null;
    const dissolveRng = makeRng(99);

    function phaseFromElapsed(e: number): Phase {
      if (e < SCATTERED_END) return "scattered";
      if (e < FORMING_END) return "forming";
      if (e < HOLDING_END) return "holding";
      return "dissolving";
    }

    function handlePhaseTransition(phase: Phase) {
      if (phase === lastPhase) return;
      if (phase === "forming") {
        for (let i = 0; i < TARGET_COUNT; i++) {
          const p = particles[i];
          p.formStartX = p.x;
          p.formStartY = p.y;
        }
      } else if (phase === "dissolving") {
        for (let i = 0; i < TARGET_COUNT; i++) {
          const p = particles[i];
          const dx = p.x - cssWidth / 2;
          const dy = p.y - cssHeight / 2;
          const mag = Math.hypot(dx, dy) || 1;
          const speed = 0.25 + dissolveRng() * 0.35;
          p.vx = (dx / mag) * speed + (dissolveRng() - 0.5) * 0.2;
          p.vy = (dy / mag) * speed + (dissolveRng() - 0.5) * 0.2;
        }
      }
      lastPhase = phase;
    }

    function tick(now: number) {
      const elapsed = (now - loopStart) % CYCLE_MS;
      const phase = phaseFromElapsed(elapsed);
      handlePhaseTransition(phase);

      // Position update
      if (phase === "scattered") {
        for (const p of particles) driftParticle(p, false);
      } else if (phase === "forming") {
        const t = (elapsed - SCATTERED_END) / FORMING_MS;
        const e = easeInOutCubic(t);
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          if (p.kind === "drifter") {
            driftParticle(p, true);
          } else {
            p.x = p.formStartX + (p.targetX - p.formStartX) * e;
            p.y = p.formStartY + (p.targetY - p.formStartY) * e;
          }
        }
      } else if (phase === "holding") {
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          if (p.kind === "drifter") {
            driftParticle(p, false);
          } else {
            p.x = p.targetX;
            p.y = p.targetY;
          }
        }
      } else {
        for (const p of particles) driftParticle(p, false);
      }

      // Envelopes
      let chartIntensity = 0;
      let dotIntensity = 0;
      let colorIntensity = 0;
      if (phase === "forming") {
        const t = (elapsed - SCATTERED_END) / FORMING_MS;
        const e = easeInOutCubic(t);
        chartIntensity = e;
        dotIntensity = e;
        colorIntensity = e;
      } else if (phase === "holding") {
        chartIntensity = 1;
        dotIntensity = 1;
        colorIntensity = 1;
      } else if (phase === "dissolving") {
        // Chart lines snap off (particles fly outward); dots + colors fade.
        const t = (elapsed - HOLDING_END) / DISSOLVING_MS;
        const e = easeInOutCubic(t);
        chartIntensity = 0;
        dotIntensity = 1 - e;
        colorIntensity = 1 - e;
      }

      drawFrame(phase, chartIntensity, dotIntensity, colorIntensity);
      rafId = requestAnimationFrame(tick);
    }

    function start() {
      if (rafId) return;
      loopStart = performance.now() - savedElapsed;
      rafId = requestAnimationFrame(tick);
    }

    function stop() {
      if (!rafId) return;
      savedElapsed = (performance.now() - loopStart) % CYCLE_MS;
      cancelAnimationFrame(rafId);
      rafId = 0;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const nowVisible = e.isIntersecting;
          if (nowVisible && !isVisible) {
            isVisible = true;
            start();
          } else if (!nowVisible && isVisible) {
            isVisible = false;
            stop();
          }
        }
      },
      { threshold: 0 },
    );
    io.observe(section);

    const ro = new ResizeObserver(() => {
      resizeCanvas();
      lastPhase = null;
    });
    ro.observe(section);

    start();

    return () => {
      io.disconnect();
      ro.disconnect();
      stop();
    };
  }, []);

  const textLayer: React.CSSProperties = { position: "relative", zIndex: 1 };

  return (
    <section className="pulse-hero" ref={heroRef}>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          opacity: 0.65,
        }}
      />

      <h1
        className="pulse-hero__word"
        aria-label={WORD}
        style={textLayer}
      >
        {WORD.split("").map((char, i) => (
          <span key={i} className="letter-mask" aria-hidden="true">
            <span className="letter">{char}</span>
          </span>
        ))}
      </h1>

      <p className="pulse-hero__tagline hero-subline" style={textLayer}>
        REAL-TIME MARKETS · PROFESSIONAL GRADE
      </p>

      <Link
        href="/dashboard"
        className="pulse-hero__cta hero-cta"
        style={textLayer}
      >
        LAUNCH TERMINAL →
      </Link>

      <div
        className="pulse-hero__scroll"
        aria-hidden="true"
        style={{
          opacity: scrollHidden ? 0 : 1,
          transition: "opacity 200ms ease",
          pointerEvents: scrollHidden ? "none" : "auto",
          zIndex: 1,
        }}
      >
        <span className="pulse-hero__scroll-label">SCROLL</span>
        <span className="pulse-hero__scroll-line" />
      </div>
    </section>
  );
}
