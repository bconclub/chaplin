import type { ReactNode } from "react";
import { IconActors, IconBriefcase, IconFeed, IconFilm, IconHome } from "@/components/Icons";

type RailItem = { label: string; href: string; icon: ReactNode; active?: boolean };

/**
 * The rail mirrors the application's real navigation — the same destinations
 * BottomNav exposes. An earlier version listed Discover, Worlds, Microdramas,
 * AI Shorts, Behind the Scenes, Collaborations, Library, Analytics, Messages,
 * Notifications and Settings. None of those are routes in this product, so
 * every one of them was a dead link dressed up as a feature.
 */
export const RAIL_PRIMARY: RailItem[] = [
  { label: "Home", href: "/", active: true, icon: <IconHome className="h-4 w-4" /> },
  { label: "Feed", href: "/feed", icon: <IconFeed className="h-4 w-4" /> },
  { label: "Actors", href: "/characters", icon: <IconActors className="h-4 w-4" /> },
  { label: "Series", href: "/series", icon: <IconFilm className="h-4 w-4" /> },
  { label: "Studio", href: "/studio", icon: <IconBriefcase className="h-4 w-4" /> },
];

/** Collection tiles, counted from the live catalogue rather than hardcoded. */
export const COLLECTIONS: Array<{ title: string; href: string; meta: (characters: number, stories: number) => string }> = [
  { title: "Featured actors", href: "/characters", meta: (c) => `${c} actors` },
  { title: "Stories", href: "/stories", meta: (_c, s) => `${s} stories` },
  { title: "Series", href: "/series", meta: (_c, s) => `${s} series` },
  { title: "Creator feed", href: "/feed", meta: (c) => `${c} creators` },
  { title: "Studio", href: "/studio", meta: () => "Start a production" },
];

export const TRENDING_LABELS = [
  "#CyberNoir",
  "#AIActors",
  "#MicroDrama",
  "#HeroVerse",
  "#FantasyWorlds",
];
