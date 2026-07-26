"use client";

import { useEffect, useRef, useState } from "react";

const DURATION_MS = 900;

function format(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

/**
 * Counts up to the supplied figure once, then tracks it exactly. The animation
 * is skipped entirely under prefers-reduced-motion, and the final frame always
 * renders the true value so the number on screen is never an approximation.
 */
export default function CountUp({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!Number.isFinite(value)) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || value <= 0) {
      // Deferred a frame so the effect body never sets state synchronously.
      frameRef.current = requestAnimationFrame(() => setDisplay(value));
      return () => {
        if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      };
    }
    const start = performance.now();
    const from = 0;
    function step(now: number) {
      const progress = Math.min(1, (now - start) / DURATION_MS);
      // Ease-out cubic: fast first, settles gently on the real figure.
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(progress === 1 ? value : Math.round(from + (value - from) * eased));
      if (progress < 1) frameRef.current = requestAnimationFrame(step);
    }
    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [value]);

  return <span className="tabular-nums">{format(display)}</span>;
}
