"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";

export default function SmoothScroll() {
  const lenisRef = useRef<Lenis | null>(null);
  const pathname = usePathname();
  /*
    Workspace canvases own their scrolling: each column is a fixed-height
    element with its own overflow, and Lenis intercepts the wheel to drive the
    window instead - which those pages never scroll - so the columns receive
    nothing and read as frozen.

    This was a path whitelist that missed /studio/write. The Scene Studio canvas
    shipped after the list was written, so its rail, editor, and asset panel
    could not be scrolled at all. Matching the whole /studio subtree means a new
    workspace route cannot silently inherit the same bug.
  */
  const usesNativeWorkspaceScroll =
    pathname === "/studio" ||
    pathname.startsWith("/studio/") ||
    pathname === "/characters/new" ||
    (pathname.startsWith("/characters/") && pathname.endsWith("/studio"));

  useEffect(() => {
    if (usesNativeWorkspaceScroll) {
      lenisRef.current?.destroy();
      lenisRef.current = null;
      return;
    }

    const lenis = new Lenis({
      duration: 1.1,
      smoothWheel: true,
    });
    lenisRef.current = lenis;

    let frame: number;
    function raf(time: number) {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    }
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [usesNativeWorkspaceScroll]);

  // Next's App Router does its own scroll-to-top on navigation, but Lenis
  // intercepts native scroll and keeps its own internal position, so it
  // fights that reset and the new page opens wherever the old one left off.
  useEffect(() => {
    window.scrollTo(0, 0);
    lenisRef.current?.scrollTo(0, { immediate: true, force: true });
  }, [pathname]);

  return null;
}
