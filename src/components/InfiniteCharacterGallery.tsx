"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Character } from "@/lib/types";
import { ARCHETYPE_HUE, ARCHETYPE_LABEL, hsl } from "@/lib/format";
import { useChaplinStore } from "@/lib/store";
import type { HomepageBroll } from "@/components/HeroGridCard";

const CASTING_FORMATS = ["Reels", "Ads", "Micro Drama", "UGC"];
const FEATURED_LIMIT = 5;

function artworkFor(character: Character) {
  return character.imageUrl ?? character.bannerUrl ?? character.galleryUrls?.[0] ?? null;
}

function featureScore(character: Character, broll?: HomepageBroll) {
  return (broll?.videoUrl || character.videoUrl ? 1_000_000 : 0)
    + (artworkFor(character) ? 100_000 : 0)
    + character.stats.castings * 100
    + character.stats.fans;
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function FeaturedActorCard({
  character,
  broll,
  active,
  onActivate,
  onPlaybackComplete,
}: {
  character: Character;
  broll?: HomepageBroll;
  active: boolean;
  onActivate: () => void;
  onPlaybackComplete: () => void;
}) {
  const pressedWhileActive = useRef(false);
  const artwork = artworkFor(character);
  const video = broll?.videoUrl ?? character.videoUrl ?? null;
  const hue = ARCHETYPE_HUE[character.archetype];

  return (
    <article
      className={`group relative h-[22rem] min-w-[72vw] overflow-hidden rounded-xl border bg-black/30 transition-[border-color,box-shadow,transform] duration-300 sm:min-w-[17rem] lg:h-full lg:min-w-0 ${
        active
          ? "border-accent shadow-[0_0_0_1px_rgba(242,78,112,0.45),0_18px_60px_rgba(0,0,0,0.45)]"
          : "border-line hover:-translate-y-1 hover:border-white/30"
      }`}
      data-featured-actor={character.id}
      data-featured-active={active ? "true" : "false"}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") onActivate();
      }}
    >
      <Link
        href={`/characters/${character.id}`}
        className="absolute inset-0 block"
        onFocus={onActivate}
        onPointerDown={() => {
          pressedWhileActive.current = active;
        }}
        onClick={(event) => {
          if (!pressedWhileActive.current) {
            event.preventDefault();
            onActivate();
          }
        }}
        aria-label={`${active ? "Open" : "Preview"} ${character.name}`}
      >
        {artwork ? (
          <Image
            src={artwork}
            alt={character.name}
            fill
            priority={active}
            quality={90}
            sizes="(max-width: 640px) 72vw, (max-width: 1024px) 17rem, 18vw"
            className="object-cover transition-transform duration-700 group-hover:scale-[1.025]"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(150deg, ${hsl(hue, 52, 24)}, ${hsl(hue, 45, 7)})` }}
          />
        )}
        {active && video && (
          <video
            key={video}
            src={video}
            autoPlay
            muted
            playsInline
            preload="metadata"
            onEnded={onPlaybackComplete}
            className="absolute inset-0 h-full w-full object-cover motion-reduce:hidden"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/5 to-black/15" />
        <span className="absolute left-3 top-3 rounded-full border border-white/20 bg-black/45 px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.15em] text-white backdrop-blur-md">
          {ARCHETYPE_LABEL[character.archetype]}
        </span>
        <div className="absolute inset-x-0 bottom-0 p-4">
          <p className="marquee-title text-base uppercase leading-none text-white">{character.name}</p>
          <p className="mt-1 truncate text-[10px] text-white/65">{character.tagline}</p>
          {active && (
            <div className="mt-3 h-0.5 overflow-hidden rounded-full bg-white/20">
              <span className="block h-full w-full origin-left animate-[featured-progress_5s_linear] bg-accent motion-reduce:animate-none" />
            </div>
          )}
        </div>
      </Link>
    </article>
  );
}

export default function InfiniteCharacterGallery() {
  const characters = useChaplinStore((state) => state.characters);
  const [castingFormatIndex, setCastingFormatIndex] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [brolls, setBrolls] = useState<HomepageBroll[]>([]);

  const brollByCharacter = useMemo(
    () => new Map(brolls.map((broll) => [broll.characterId, broll])),
    [brolls],
  );
  const featured = useMemo(
    () => [...characters]
      .sort((left, right) =>
        featureScore(right, brollByCharacter.get(right.id))
        - featureScore(left, brollByCharacter.get(left.id)))
      .slice(0, FEATURED_LIMIT),
    [brollByCharacter, characters],
  );
  const currentId = featured.some((character) => character.id === activeId)
    ? activeId
    : featured[0]?.id ?? null;
  const totalPerformances = characters.reduce((total, character) => total + character.stats.castings, 0);
  const creatorCount = new Set(characters.map((character) => character.makerId)).size;
  const readyVideoCount = characters.filter((character) =>
    brollByCharacter.get(character.id)?.videoUrl || character.videoUrl
  ).length;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCastingFormatIndex((current) => (current + 1) % CASTING_FORMATS.length);
    }, 2400);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    function loadBrolls() {
      void fetch("/api/broll", { cache: "no-store" })
        .then((response) => {
          if (!response.ok) throw new Error(`B-roll manifest returned ${response.status}.`);
          return response.json();
        })
        .then((data: { characters?: HomepageBroll[] }) => {
          if (!cancelled) setBrolls(data.characters ?? []);
        })
        .catch(() => {
          if (!cancelled) setBrolls([]);
        });
    }
    loadBrolls();
    window.addEventListener("chaplin:media-updated", loadBrolls);
    return () => {
      cancelled = true;
      window.removeEventListener("chaplin:media-updated", loadBrolls);
    };
  }, []);

  function playNext() {
    if (!currentId || featured.length < 2) return;
    const currentIndex = featured.findIndex((character) => character.id === currentId);
    setActiveId(featured[(currentIndex + 1) % featured.length].id);
  }

  if (!characters.length) return null;

  return (
    <main className="relative min-h-[calc(100dvh-5rem)] overflow-hidden pb-28" data-home-featured>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_28%,rgba(242,78,112,0.13),transparent_30%),radial-gradient(circle_at_76%_24%,rgba(7,210,190,0.12),transparent_34%)]" />
      <section className="relative mx-auto grid min-h-[calc(100dvh-8rem)] w-full max-w-[92rem] items-center gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[minmax(19rem,0.72fr)_minmax(0,1.78fr)] lg:gap-10 lg:px-10 lg:py-10" aria-label="Featured AI actors">
        <div className="max-w-lg">
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-accent">The Chaplin cast</p>
          <h1 className="reel-title mt-5 text-[clamp(3.4rem,6.5vw,6.8rem)] leading-[0.82] tracking-[-0.055em] text-ink">
            The world of
            <span className="mt-2 block text-accent">AI actors.</span>
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-grey">
            Original actors with locked faces, voices, and worlds—ready for your next{" "}
            <span
              key={CASTING_FORMATS[castingFormatIndex]}
              className="font-semibold text-accent-secondary motion-safe:animate-[chaplin-format-enter_400ms_ease-out]"
            >
              {CASTING_FORMATS[castingFormatIndex]}.
            </span>
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/characters" className="rounded-md bg-accent px-5 py-3 text-sm font-bold text-paper shadow-[0_12px_32px_rgba(242,78,112,0.2)] transition-transform hover:-translate-y-0.5">
              Explore actors →
            </Link>
            <Link href="/feed" className="rounded-md border border-line px-5 py-3 text-sm font-semibold text-ink transition-colors hover:border-accent hover:text-accent">
              Open feed
            </Link>
          </div>
          <dl className="mt-9 grid max-w-md grid-cols-3 divide-x divide-line border-t border-line pt-5">
            {[
              [characters.length, "AI actors"],
              [creatorCount, "Creators"],
              [readyVideoCount || totalPerformances, readyVideoCount ? "Ready videos" : "Performances"],
            ].map(([value, label]) => (
              <div key={label} className="px-4 first:pl-0">
                <dt className="text-xl font-semibold text-accent">{formatCount(Number(value))}</dt>
                <dd className="mt-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-grey">{label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-grey">Featured this week</p>
            <Link href="/characters" className="text-[10px] font-semibold text-grey hover:text-accent">View all →</Link>
          </div>
          <div className="chaplin-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 lg:grid lg:h-[31rem] lg:grid-cols-5 lg:overflow-visible lg:pb-0">
            {featured.map((character) => (
              <div key={character.id} className="snap-start">
                <FeaturedActorCard
                  character={character}
                  broll={brollByCharacter.get(character.id)}
                  active={character.id === currentId}
                  onActivate={() => setActiveId(character.id)}
                  onPlaybackComplete={playNext}
                />
              </div>
            ))}
          </div>
          <p className="mt-2 text-[9px] text-grey">
            <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-accent-secondary shadow-[0_0_10px_var(--accent-secondary)]" />
            Select a featured actor to preview. Select again to open the profile.
          </p>
        </div>
      </section>
    </main>
  );
}
