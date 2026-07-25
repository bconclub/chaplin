"use client";

import { useEffect, useState } from "react";

type Appearance = "dark" | "light";

const STORAGE_KEY = "chaplin-appearance";

function applyAppearance(appearance: Appearance) {
  document.documentElement.classList.toggle("theme-light", appearance === "light");
  document.documentElement.style.colorScheme = appearance;
}

export default function AppearanceToggle() {
  const [appearance, setAppearance] = useState<Appearance>(() => {
    if (typeof window === "undefined") return "dark";
    return window.localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
  });

  useEffect(() => {
    applyAppearance(appearance);
  }, [appearance]);

  function choose(next: Appearance) {
    setAppearance(next);
    applyAppearance(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <div className="inline-flex rounded-full border border-line bg-paper/70 p-1" aria-label="Dashboard appearance">
      <button
        type="button"
        onClick={() => choose("light")}
        aria-pressed={appearance === "light"}
        className={`rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition-colors ${appearance === "light" ? "bg-accent text-paper" : "text-grey hover:text-ink"}`}
      >
        ☼ Light
      </button>
      <button
        type="button"
        onClick={() => choose("dark")}
        aria-pressed={appearance === "dark"}
        className={`rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition-colors ${appearance === "dark" ? "bg-accent-secondary/15 text-accent-secondary" : "text-grey hover:text-ink"}`}
      >
        ◐ Dark
      </button>
    </div>
  );
}
