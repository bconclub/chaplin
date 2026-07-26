import type { ReactNode } from "react";

type RailItem = { label: string; href: string; icon: ReactNode; active?: boolean; badge?: number };

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      {children}
    </svg>
  );
}

export const RAIL_PRIMARY: RailItem[] = [
  { label: "Home", href: "/", active: true, icon: <Glyph><path d="M3 10.5 12 3l9 7.5" /><path d="M5.5 9.5V20h13V9.5" /></Glyph> },
  { label: "Feed", href: "/feed", icon: <Glyph><rect x="3" y="4" width="18" height="7" rx="1.5" /><path d="M3 15h11M3 19h7" /></Glyph> },
  { label: "Discover", href: "/characters", icon: <Glyph><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Glyph> },
  { label: "Characters", href: "/characters", icon: <Glyph><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /><path d="M16 6.2a3 3 0 0 1 0 5.6" /></Glyph> },
  { label: "Worlds", href: "/stories", icon: <Glyph><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.6 2.5 14.4 0 17M12 3.5c-2.5 2.6-2.5 14.4 0 17" /></Glyph> },
  { label: "Microdramas", href: "/stories", icon: <Glyph><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m10 9.5 5 2.5-5 2.5z" /></Glyph> },
  { label: "AI Shorts", href: "/videos/new", icon: <Glyph><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 5v14M17 5v14" /></Glyph> },
  { label: "Behind the Scenes", href: "/studio", icon: <Glyph><rect x="3" y="8" width="12" height="10" rx="1.5" /><path d="m15 12 6-3.5v11L15 16z" /></Glyph> },
  { label: "Collaborations", href: "/studio", icon: <Glyph><circle cx="8" cy="9" r="2.8" /><circle cx="16" cy="9" r="2.8" /><path d="M3 19c0-2.8 2.2-4.6 5-4.6M21 19c0-2.8-2.2-4.6-5-4.6" /></Glyph> },
];

export const RAIL_SECONDARY: RailItem[] = [
  { label: "Library", href: "/characters", icon: <Glyph><path d="M5 4v16M9 4v16M13.5 5l4.5 15" /></Glyph> },
  { label: "Analytics", href: "/ledger", icon: <Glyph><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Glyph> },
  { label: "Messages", href: "/feed", badge: 2, icon: <Glyph><path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" /></Glyph> },
  { label: "Notifications", href: "/feed", badge: 5, icon: <Glyph><path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></Glyph> },
  { label: "Settings", href: "/admin", icon: <Glyph><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 2.6 7" /></Glyph> },
];

/**
 * Collection tiles. Counts are derived from the live catalogue rather than
 * hardcoded, so the row never advertises numbers the product cannot back up.
 */
export const COLLECTIONS: Array<{ title: string; href: string; meta: (characters: number, stories: number) => string }> = [
  { title: "Sci-Fi Worlds", href: "/stories", meta: (_c, s) => `${s} stories` },
  { title: "Epic Characters", href: "/characters", meta: (c) => `${c} characters` },
  { title: "Microdramas", href: "/stories", meta: (_c, s) => `${s} series` },
  { title: "Behind the Scenes", href: "/studio", meta: (c) => `${c} posts` },
  { title: "AI Shorts", href: "/videos/new", meta: (c) => `${c} videos` },
];

export const TRENDING_LABELS = [
  "#CyberNoir",
  "#AIActors",
  "#MicroDrama",
  "#HeroVerse",
  "#FantasyWorlds",
];
