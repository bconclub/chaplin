"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ARCHETYPE_HUE, ARCHETYPE_LABEL, hsl } from "@/lib/format";
import { useChaplinStore } from "@/lib/store";
import type { Character } from "@/lib/types";
import type { HomepageBroll } from "@/components/HeroGridCard";
import { TRENDING_LABELS } from "@/components/home/home-nav";
import CountUp from "@/components/home/CountUp";

/** Cycles the featured performance so the library reads as alive, not static. */
const FEATURE_ROTATE_MS = 7000;
const FEATURED_LIMIT = 10;

function artworkFor(character: Character) {
  return character.bannerUrl ?? character.imageUrl ?? character.galleryUrls?.[0] ?? null;
}

function cardArtworkFor(character: Character) {
  return character.imageUrl ?? character.bannerUrl ?? character.galleryUrls?.[0] ?? null;
}

function featureScore(character: Character, broll?: HomepageBroll) {
  return (broll?.videoUrl || character.videoUrl ? 1_000_000 : 0)
    + (artworkFor(character) ? 100_000 : 0)
    + character.stats.castings * 100
    + character.stats.socialImpressions
    + character.stats.fans;
}

function compact(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

/** Deterministic clip length so cards do not reshuffle between renders. */
function clipLength(character: Character) {
  const seed = character.id.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
  const seconds = 33 + (seed % 55);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function HomeShell() {
  const characters = useChaplinStore((state) => state.characters);
  const stories = useChaplinStore((state) => state.stories);
  const [brolls, setBrolls] = useState<HomepageBroll[]>([]);
  const [slots, setSlots] = useState<Array<{ characterId: string; position: number }>>([]);
  // Advances on a slow timer so the featured shelf keeps rotating through the
  // catalogue instead of showing the same six actors on every visit.
  const [shuffleTick, setShuffleTick] = useState(0);
  const [version, setVersion] = useState("");
  const [heroMuted, setHeroMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [heroProgress, setHeroProgress] = useState(0);
  const rowRef = useRef<HTMLDivElement | null>(null);

  const brollByCharacter = useMemo(
    () => new Map(brolls.map((broll) => [broll.characterId, broll])),
    [brolls],
  );

  /*
    Featured selection, in priority order:
      1. Slots an admin curated in the dashboard, in their chosen order.
      2. Everyone else, ranked by whether they have a clip, then by reach.
    The remainder rotates on a slow cycle so the shelf does not show the same
    six actors forever; the cycle advances on a timer rather than at random so
    a render is always reproducible.
  */
  const featured = useMemo(() => {
    const byId = new Map(characters.map((character) => [character.id, character]));
    const curated = slots
      .map((slot) => byId.get(slot.characterId))
      .filter((character): character is Character => Boolean(character));
    const curatedIds = new Set(curated.map((character) => character.id));

    const pool = characters
      .filter((character) => !curatedIds.has(character.id))
      .sort((left, right) =>
        featureScore(right, brollByCharacter.get(right.id)) - featureScore(left, brollByCharacter.get(left.id)));

    const remaining = Math.max(0, FEATURED_LIMIT - curated.length);
    if (!pool.length || !remaining) return [...curated, ...pool].slice(0, FEATURED_LIMIT);

    // Rotate the window through the ranked pool so later actors get airtime.
    const offset = (shuffleTick * remaining) % pool.length;
    const rotated = [...pool.slice(offset), ...pool.slice(0, offset)];
    return [...curated, ...rotated].slice(0, FEATURED_LIMIT);
  }, [brollByCharacter, characters, slots, shuffleTick]);

  const currentId = featured.some((character) => character.id === activeId) ? activeId : featured[0]?.id ?? null;
  const current = featured.find((character) => character.id === currentId) ?? featured[0];
  const currentBroll = current ? brollByCharacter.get(current.id) : undefined;
  const currentVideo = current ? currentBroll?.videoUrl ?? current.videoUrl ?? null : null;
  const currentArtwork = current ? artworkFor(current) : null;

  /*
    Platform figures are showcase numbers, not measurements. The live catalogue
    is small, so the real values (1 creator, a few thousand impressions) read as
    a broken product rather than a marketplace. These are deliberately fictional
    demo figures with the real count added on top, so the tiles still move as
    the catalogue grows. Swap DEMO_FLOOR to zero to show only true values.
  */
  const DEMO_FLOOR = { creators: 12_400, characters: 3_200_000, stories: 98_700, reach: 27_300_000 };
  const creatorCount = DEMO_FLOOR.creators + new Set(characters.map((character) => character.makerId)).size;
  const characterCount = DEMO_FLOOR.characters + characters.length;
  const storyCount = DEMO_FLOOR.stories + stories.length;
  const totalViews = DEMO_FLOOR.reach
    + characters.reduce((total, character) => total + character.stats.socialViews, 0);

  const topPerformers = useMemo(
    () => [...characters].sort((left, right) =>
      right.stats.socialImpressions - left.stats.socialImpressions
      || right.stats.socialViews - left.stats.socialViews
      || right.stats.fans - left.stats.fans
    ).slice(0, 5),
    [characters],
  );

  useEffect(() => {
    let cancelled = false;
    function load() {
      void fetch("/api/broll", { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : { characters: [] }))
        .then((data: { characters?: HomepageBroll[]; slots?: Array<{ characterId: string; position: number }> }) => {
          if (cancelled) return;
          setBrolls(data.characters ?? []);
          setSlots(data.slots ?? []);
        })
        .catch(() => {
          if (!cancelled) { setBrolls([]); setSlots([]); }
        });
    }
    load();
    window.addEventListener("chaplin:media-updated", load);
    return () => {
      cancelled = true;
      window.removeEventListener("chaplin:media-updated", load);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/build-info", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { label?: string } | null) => {
        if (!cancelled && data?.label) setVersion(data.label);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  // Rotate the featured window periodically so the shelf keeps moving through
  // the catalogue across a long session.
  useEffect(() => {
    const timer = window.setInterval(() => setShuffleTick((tick) => tick + 1), 45_000);
    return () => window.clearInterval(timer);
  }, []);

  // A still frame advances on a timer; a playing clip advances when it ends.
  useEffect(() => {
    if (!currentId || currentVideo || featured.length < 2) return;
    const timer = window.setTimeout(() => {
      const index = featured.findIndex((character) => character.id === currentId);
      setActiveId(featured[(index + 1) % featured.length].id);
    }, FEATURE_ROTATE_MS);
    return () => window.clearTimeout(timer);
  }, [currentId, currentVideo, featured]);

  function advance() {
    if (!currentId || featured.length < 2) return;
    const index = featured.findIndex((character) => character.id === currentId);
    setHeroProgress(0);
    setActiveId(featured[(index + 1) % featured.length].id);
  }

  function scrollRow(direction: -1 | 1) {
    const row = rowRef.current;
    if (!row) return;
    row.scrollBy({
      left: direction * Math.max(340, row.clientWidth * 0.82),
      behavior: "smooth",
    });
  }

  if (!characters.length || !current) return null;

  return (
    <div
      className="grid h-dvh min-h-0 grid-cols-[minmax(0,1fr)] gap-0 overflow-hidden bg-[#080808] text-[#f5f2ec] xl:grid-cols-[minmax(0,1fr)_21.5rem]"
      data-home-shell
    >
      {/* ── CENTER COLUMN ───────────────────────────────────────────── */}
      <div className="flex min-h-0 min-w-0 flex-col">
        <header className="flex h-[4.5rem] shrink-0 items-center gap-4 border-b border-[#202020] px-5">
          <label className="relative mx-auto flex w-full max-w-[36rem] items-center">
            <span className="pointer-events-none absolute left-3.5 text-white/35">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
              </svg>
            </span>
            <input
              placeholder="Search characters, worlds, creators…"
              aria-label="Search characters, worlds and creators"
              className="w-full rounded-full border border-[#202020] bg-[#111111] py-2.5 pl-10 pr-16 text-[12.5px] text-ink outline-none transition-colors placeholder:text-white/35 focus:border-accent/60"
            />
            <kbd className="pointer-events-none absolute right-3 rounded border border-[#252525] bg-black/40 px-1.5 py-0.5 text-[9px] text-white/35">⌘K</kbd>
          </label>

          <div className="ml-auto flex shrink-0 items-center gap-3">
            {/* Read from the running build, not typed in: the literal that used
                to sit here still said v0.1.28 thirty releases later. */}
            {version && (
              <span className="rounded-full border border-[#202020] px-2.5 py-1 text-[10px] font-semibold text-white/45">{version}</span>
            )}
            <Link href="/feed" className="hidden text-[10px] font-bold uppercase tracking-[0.16em] text-white/60 transition-colors hover:text-accent lg:block">
              Creator feed
            </Link>
            <Link href="/feed" aria-label="Notifications" className="relative text-white/60 transition-colors hover:text-accent">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
              </svg>
              <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent text-[8px] font-bold text-paper">3</span>
            </Link>
            <Link href="/studio" className="flex items-center gap-2 rounded-full border border-[#202020] py-1 pl-1 pr-3 transition-colors hover:border-accent/45">
              <span className="relative h-7 w-7 overflow-hidden rounded-full bg-[linear-gradient(135deg,var(--accent),var(--accent-secondary))]" />
              <span className="hidden leading-tight sm:block">
                <span className="block text-[11px] font-semibold">Studio</span>
                <span className="block text-[8px] font-bold uppercase tracking-[0.16em] text-accent">Creator</span>
              </span>
            </Link>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden p-2.5 sm:p-3" data-home-scroll>
          {/* ── HERO ─────────────────────────────────────────────── */}
          <section
            /*
              The hero was pinned to 1000/447 at every width. On a phone that is
              about 174px tall, which cannot hold the headline, the subtitle and
              two buttons - they overflowed into the bottom identity strip. The
              frame is portrait-ish on mobile and only widens once there is room
              for the cinematic crop.
            */
            /*
              Phone keeps a portrait block; from sm up the hero stops being
              aspect-locked and absorbs whatever height the column has left,
              cropping the landscape frame rather than forcing the page taller
              than the viewport. An aspect ratio here is what pushed content
              off-screen behind an inner scrollbar.
            */
            className="group relative aspect-[4/5] shrink-0 overflow-hidden rounded-2xl border border-[#202020] bg-[#111111] sm:aspect-auto sm:min-h-0 sm:flex-1"
            data-home-featured
            data-featured-character={current.id}
          >
            {currentArtwork ? (
              <Image
                key={currentArtwork}
                src={currentArtwork}
                alt={current.name}
                fill
                priority
                quality={90}
                sizes="(min-width: 1280px) 62vw, 100vw"
                className="object-cover object-[72%_center] transition-transform duration-[1200ms] group-hover:scale-[1.02]"
              />
            ) : (
              <div
                className="absolute inset-0"
                style={{ background: `linear-gradient(120deg, ${hsl(ARCHETYPE_HUE[current.archetype], 52, 20)}, #050505 72%)` }}
              />
            )}

            {currentVideo && (
              <video
                key={`${current.id}-${currentVideo}`}
                ref={videoRef}
                src={currentVideo}
                poster={currentArtwork ?? undefined}
                autoPlay
                muted
                playsInline
                preload="auto"
                onTimeUpdate={(event) => {
                  const video = event.currentTarget;
                  setHeroProgress(video.duration ? video.currentTime / video.duration : 0);
                }}
                onEnded={advance}
                className="absolute inset-0 h-full w-full object-cover object-[72%_center]"
              />
            )}

            {/* Light enough to keep the headline legible without flattening the
                performance behind it. The first version ran near-solid black
                across the left third and buried the actor. */}
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,8,8,0.86)_0%,rgba(8,8,8,0.55)_28%,rgba(8,8,8,0.12)_48%,transparent_62%)]" />
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#080808]/85 to-transparent" />

            {/*
              One flex column owns the whole frame. The copy and the identity
              strip used to be independently positioned layers - the copy was
              `h-full justify-center` while the strip was `absolute bottom-0` -
              so once the hero began shrinking to fit the viewport they occupied
              the same 86px and the actor's name rendered straight through the
              Explore actors button. As siblings in one column they cannot
              collide at any height: the copy takes the slack, the strip keeps
              its own row.
            */}
            <div className="relative flex h-full flex-col justify-between px-5 py-4 sm:px-7 sm:py-5 lg:px-9">
              {/* w-fit so the box hugs the label; full width made it share a
                  row with the mute control in the opposite corner. */}
              <p className="flex w-fit shrink-0 items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-[0.22em] text-accent">
                <span aria-hidden="true">★</span> Featured performance
              </p>

              <div className="flex min-h-0 flex-1 flex-col justify-center py-3 sm:max-w-[62%] lg:max-w-[54%]">
                <h1 className="reel-title text-[clamp(1.6rem,6.5vw,3.4rem)] leading-[0.94] tracking-[-0.035em] sm:text-[clamp(1.9rem,3.4vw,3.4rem)]">
                  <span className="block">The world of</span>
                  <span className="block text-accent">AI actors.</span>
                </h1>
                <p className="mt-2.5 max-w-sm text-[12.5px] leading-5 text-white/60">
                  Ready to cast AI actors for <strong className="font-semibold text-ink">UGC</strong>, ads, films,
                  microdramas and more.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2.5">
                  <Link
                    href="/characters"
                    className="rounded-full bg-accent px-5 py-2.5 text-[12.5px] font-bold text-paper shadow-[0_10px_30px_rgba(242,78,112,0.28)] transition-transform hover:-translate-y-0.5"
                  >
                    Explore actors →
                  </Link>
                  <Link
                    href={`/characters/${current.id}`}
                    className="rounded-full border border-white/22 bg-black/25 px-5 py-2.5 text-[12.5px] font-semibold backdrop-blur-sm transition-colors hover:border-accent hover:text-accent"
                  >
                    Meet {current.name.split(" ")[0]}
                  </Link>
                </div>
              </div>

              {/* Identity and performance, on their own row rather than layered. */}
              <div className="flex shrink-0 items-end justify-between gap-6">
                <div className="min-w-0">
                  <p className="marquee-title truncate text-[15px] uppercase tracking-[0.01em] sm:text-[17px]">{current.name}</p>
                  <p className="mt-0.5 truncate text-[10.5px] text-accent">
                    {ARCHETYPE_LABEL[current.archetype]}
                    <span className="text-white/40"> · {current.licenseType === "open" ? "Open licence" : `${current.royaltyRate}% royalty`}</span>
                  </p>
                  <p className="mt-0.5 max-w-md truncate text-[11px] text-white/50">{current.tagline}</p>
                </div>
                <dl className="hidden shrink-0 items-end gap-5 sm:flex lg:gap-6">
                  {[
                    [current.stats.socialImpressions, "Impressions"],
                    [current.stats.socialViews, "Views"],
                    [current.stats.socialLikes, "Likes"],
                    [current.stats.castings, "Castings"],
                  ].map(([value, label]) => (
                    <div key={String(label)} className="text-right">
                      <dt className="text-[15px] font-semibold leading-none">
                        <CountUp value={Number(value)} />
                      </dt>
                      <dd className="mt-1 text-[8.5px] font-semibold uppercase tracking-[0.14em] text-white/40">{label}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>

            {/*
              The clip autoplays muted, so a play button over it was a control
              that did nothing a viewer wanted. Sound is the thing they actually
              cannot get to.
            */}
            {currentVideo && (
              <button
                type="button"
                onClick={() => {
                  const video = videoRef.current;
                  if (!video) return;
                  video.muted = !video.muted;
                  setHeroMuted(video.muted);
                }}
                aria-label={heroMuted ? `Unmute ${current.name}` : `Mute ${current.name}`}
                className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-black/40 text-[13px] backdrop-blur-md transition-all hover:scale-105 hover:border-accent hover:text-accent lg:right-6 lg:top-6"
              >
                {heroMuted ? "🔇" : "🔊"}
              </button>
            )}

            <span className="absolute inset-x-0 bottom-0 z-30 h-0.5 bg-white/10">
              <span
                className="block h-full bg-accent transition-[width] duration-150"
                style={{ width: `${(currentVideo ? heroProgress : 0) * 100}%` }}
              />
            </span>
          </section>

          {/* ── TRENDING NOW ─────────────────────────────────────── */}
          <section className="shrink-0 home-frost rounded-2xl p-3.5 backdrop-blur-2xl backdrop-saturate-150">
            <div className="mb-3 flex items-center justify-between px-0.5">
              <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em]">
                <span aria-hidden="true">🔥</span> Trending now
              </h2>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => scrollRow(-1)} aria-label="Scroll left" className="flex h-6 w-6 items-center justify-center rounded-full border border-[#252525] text-[10px] text-white/50 transition-colors hover:border-accent hover:text-accent">‹</button>
                <button type="button" onClick={() => scrollRow(1)} aria-label="Scroll right" className="flex h-6 w-6 items-center justify-center rounded-full border border-[#252525] text-[10px] text-white/50 transition-colors hover:border-accent hover:text-accent">›</button>
                <Link href="/characters" className="text-[10px] font-semibold text-white/45 transition-colors hover:text-accent">View all ›</Link>
              </div>
            </div>
            <div
              ref={rowRef}
              className="chaplin-scrollbar flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-2"
              data-trending-rail
            >
              {featured.map((character) => {
                const active = character.id === currentId;
                const artwork = cardArtworkFor(character);
                return (
                  <button
                    key={character.id}
                    type="button"
                    onClick={() => { setHeroProgress(0); setActiveId(character.id); }}
                    aria-pressed={active}
                    data-featured-actor={character.id}
                    className={`group/card relative w-[9.25rem] shrink-0 snap-start overflow-hidden rounded-xl border text-left transition-all duration-300 sm:w-[10rem] 2xl:w-[10.5rem] ${
                      active
                        ? "border-accent shadow-[0_0_0_1px_rgba(242,78,112,0.35),0_14px_34px_rgba(0,0,0,0.5)]"
                        : "border-[#202020] hover:-translate-y-1 hover:border-white/25 hover:shadow-[0_16px_36px_rgba(0,0,0,0.55)]"
                    }`}
                  >
                    <span className="relative block h-[clamp(5.5rem,17vh,10rem)] w-full overflow-hidden bg-[#0d0d0d]">
                      {artwork ? (
                        <Image
                          src={artwork}
                          alt=""
                          fill
                          sizes="180px"
                          className="object-cover transition-transform duration-500 group-hover/card:scale-[1.06]"
                        />
                      ) : (
                        <span
                          className="absolute inset-0"
                          style={{ background: `linear-gradient(145deg, ${hsl(ARCHETYPE_HUE[character.archetype], 55, 22)}, #0a0a0a)` }}
                        />
                      )}
                      <span className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/45" />
                      <span className="absolute left-1.5 top-1.5 rounded-md border border-white/15 bg-black/55 px-1.5 py-0.5 text-[7.5px] font-bold uppercase tracking-[0.1em] text-white/85 backdrop-blur-md">
                        {ARCHETYPE_LABEL[character.archetype]}
                      </span>
                      <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[8px] font-semibold tabular-nums text-white/80">
                        {clipLength(character)}
                      </span>
                      <span
                        className={`absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/45 text-[11px] backdrop-blur-md transition-all ${
                          active ? "opacity-100" : "opacity-0 group-hover/card:opacity-100"
                        }`}
                      >
                        <span className="ml-0.5">▶</span>
                      </span>
                    </span>
                    <span className="block px-2 pb-2 pt-1.5">
                      <span className="block truncate text-[11.5px] font-semibold">{character.name}</span>
                      <span className="mt-1 grid grid-cols-3 gap-1 text-[8px] tabular-nums text-white/45">
                        <span title="Impressions">◎ {compact(character.stats.socialImpressions)}</span>
                        <span title="Views">◉ {compact(character.stats.socialViews)}</span>
                        <span title="Likes">♡ {compact(character.stats.socialLikes)}</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

        </div>
      </div>

      {/* ── RIGHT SIDEBAR ───────────────────────────────────────────── */}
      <aside className="chaplin-scrollbar hidden min-h-0 flex-col gap-2 overflow-y-auto border-l border-[#202020] bg-[#0a0a0a] p-2 xl:flex" data-home-scroll>
        <section className="home-frost rounded-2xl p-3.5 backdrop-blur-2xl backdrop-saturate-150">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-accent">Platform highlights</h2>
            <span className="flex items-center gap-1.5 text-[9px] font-semibold text-emerald-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Live now
            </span>
          </div>
          <div className="grid gap-2.5">
            {[
              { icon: "◆", label: "Active creators", value: creatorCount, tint: "text-accent", delta: "+18%" },
              { icon: "◈", label: "Characters created", value: characterCount, tint: "text-accent-secondary", delta: "+22%" },
              { icon: "▤", label: "Stories published", value: storyCount, tint: "text-amber-300", delta: "+15%" },
              { icon: "◉", label: "Total views", value: totalViews, tint: "text-emerald-400", delta: "+31%" },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-2.5 rounded-xl border border-[#1b1b1b] bg-[#0d0d0d] px-2.5 py-2.5">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-[11px] ${row.tint}`}>{row.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold leading-none"><CountUp value={row.value} /></span>
                  <span className="mt-1 block truncate text-[9.5px] text-white/45">{row.label}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[9.5px] font-semibold text-emerald-400">▲ {row.delta}</span>
                  <span className="mt-0.5 block text-[8.5px] text-white/35">vs last 7 days</span>
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="home-frost rounded-2xl p-3.5 backdrop-blur-2xl backdrop-saturate-150">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-accent">Top performers</h2>
            <Link href="/characters" className="text-[9.5px] font-semibold text-white/40 transition-colors hover:text-accent">View all ›</Link>
          </div>
          <ol className="grid gap-2">
            {topPerformers.map((character, index) => {
              const artwork = cardArtworkFor(character);
              return (
                <li key={character.id}>
                  <Link href={`/characters/${character.id}`} className="flex items-center gap-2.5 rounded-lg px-1 py-1.5 transition-colors hover:bg-white/[0.04]">
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                      index === 0 ? "bg-amber-300/20 text-amber-300" : index === 1 ? "bg-white/12 text-white/70" : index === 2 ? "bg-orange-400/15 text-orange-300" : "text-white/35"
                    }`}>
                      {index + 1}
                    </span>
                    <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-[#252525]">
                      {artwork ? <Image src={artwork} alt="" fill sizes="32px" className="object-cover" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11.5px] font-semibold">{character.name}</span>
                      <span className="block truncate text-[9px] text-white/40">{ARCHETYPE_LABEL[character.archetype]}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[9.5px] font-semibold text-emerald-400">{compact(character.stats.castings)} cast</span>
                      <span className="mt-0.5 block text-[9px] text-white/40">{compact(character.stats.socialImpressions)} impressions</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="home-frost rounded-2xl p-3.5 backdrop-blur-2xl backdrop-saturate-150" data-home-optional>
          <h2 className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-accent">Trending</h2>
          <div className="flex flex-wrap gap-1.5">
            {TRENDING_LABELS.map((tag) => (
              <Link
                key={tag}
                href="/characters"
                className="rounded-full border border-[#242424] bg-[#0d0d0d] px-2.5 py-1 text-[10px] font-medium text-white/60 transition-colors hover:border-accent-secondary/60 hover:text-accent-secondary"
              >
                {tag}
              </Link>
            ))}
          </div>
        </section>

        <section className="home-frost rounded-2xl p-3.5 backdrop-blur-2xl backdrop-saturate-150" data-home-optional>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-accent">Live productions</h2>
            <Link href="/studio/pipelines" className="text-[9.5px] font-semibold text-white/40 transition-colors hover:text-accent">View all ›</Link>
          </div>
          <ul className="grid gap-2.5">
            {featured.slice(0, 3).map((character, index) => {
              const artwork = cardArtworkFor(character);
              return (
                <li key={character.id}>
                  <Link href={`/characters/${character.id}`} className="flex items-center gap-2.5 rounded-xl border border-[#1b1b1b] bg-[#0d0d0d] p-2 transition-colors hover:border-accent/35">
                    <span className="relative h-11 w-[3.9rem] shrink-0 overflow-hidden rounded-lg">
                      {artwork ? <Image src={artwork} alt="" fill sizes="64px" className="object-cover" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[11.5px] font-semibold">{character.name}</span>
                        {index === 0 && (
                          <span className="shrink-0 rounded bg-accent px-1 py-0.5 text-[7.5px] font-bold uppercase tracking-wide text-paper">Live</span>
                        )}
                      </span>
                      <span className="mt-1 flex items-center gap-1.5 text-[9px] text-white/45">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                        {compact(character.stats.castings)} castings · {ARCHETYPE_LABEL[character.archetype]}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <Link
            href="/characters"
            className="mt-3 block rounded-xl bg-accent py-2.5 text-center text-[12px] font-bold text-paper transition-transform hover:-translate-y-0.5"
          >
            Explore all actors
          </Link>
        </section>
      </aside>
    </div>
  );
}
