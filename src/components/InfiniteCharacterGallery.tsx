"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { HomepageBroll } from "@/components/HeroGridCard";
import { ARCHETYPE_HUE, ARCHETYPE_LABEL, hsl } from "@/lib/format";
import { useChaplinStore } from "@/lib/store";
import type { Character } from "@/lib/types";

const CASTING_FORMATS = ["Reels", "Ads", "Micro Drama", "UGC"];
const FEATURED_LIMIT = 6;

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
    + character.stats.fans;
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function FeaturedLandscapeCard({
  character,
  active,
  onActivate,
}: {
  character: Character;
  active: boolean;
  onActivate: () => void;
}) {
  const artwork = cardArtworkFor(character);
  const hue = ARCHETYPE_HUE[character.archetype];

  return (
    <button
      type="button"
      onClick={onActivate}
      className={`group relative aspect-[16/10] min-w-[68vw] snap-start overflow-hidden rounded-lg border text-left transition-[border-color,box-shadow,transform] duration-300 sm:min-w-[16rem] lg:min-w-0 ${
        active
          ? "border-accent shadow-[0_0_0_1px_rgba(242,78,112,0.28),0_14px_38px_rgba(0,0,0,0.32)]"
          : "border-white/10 hover:-translate-y-0.5 hover:border-white/30"
      }`}
      aria-pressed={active}
      aria-label={`Feature ${character.name}`}
      data-featured-actor={character.id}
      data-featured-active={active ? "true" : "false"}
    >
      {artwork ? (
        <Image
          src={artwork}
          alt=""
          fill
          sizes="(max-width: 640px) 68vw, (max-width: 1024px) 16rem, 19vw"
          className="object-cover transition-transform duration-700 group-hover:scale-[1.035]"
        />
      ) : (
        <span
          className="absolute inset-0"
          style={{
            background: `linear-gradient(145deg, ${hsl(hue, 55, 24)}, ${hsl(hue, 48, 7)})`,
          }}
        />
      )}
      <span className="absolute inset-0 bg-gradient-to-t from-black via-black/5 to-black/10" />
      <span className="absolute left-2.5 top-2.5 rounded-full border border-white/15 bg-black/45 px-2 py-1 text-[7px] font-bold uppercase tracking-[0.13em] text-white/90 backdrop-blur-md">
        {ARCHETYPE_LABEL[character.archetype]}
      </span>
      {active && (
        <span className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full border border-accent/70 bg-accent text-[10px] text-paper shadow-[0_0_18px_rgba(242,78,112,0.42)]">
          ▶
        </span>
      )}
      <span className="absolute inset-x-0 bottom-0 p-3">
        <span className="marquee-title block text-sm uppercase leading-none text-white">
          {character.name}
        </span>
        <span className="mt-1 block truncate text-[9px] text-white/60">
          {character.tagline}
        </span>
      </span>
    </button>
  );
}

export default function InfiniteCharacterGallery() {
  const characters = useChaplinStore((state) => state.characters);
  const [castingFormatIndex, setCastingFormatIndex] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [brolls, setBrolls] = useState<HomepageBroll[]>([]);
  const [heroProgress, setHeroProgress] = useState(0);

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
  const currentCharacter = featured.find((character) => character.id === currentId) ?? featured[0];
  const currentBroll = currentCharacter ? brollByCharacter.get(currentCharacter.id) : undefined;
  const currentVideo = currentCharacter
    ? currentBroll?.videoUrl ?? currentCharacter.videoUrl ?? null
    : null;
  const currentArtwork = currentCharacter ? artworkFor(currentCharacter) : null;
  const totalPerformances = characters.reduce(
    (total, character) => total + character.stats.castings,
    0,
  );
  const creatorCount = new Set(characters.map((character) => character.makerId)).size;

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

  useEffect(() => {
    if (!currentId || currentVideo || featured.length < 2) return;
    const timer = window.setTimeout(() => {
      const currentIndex = featured.findIndex((character) => character.id === currentId);
      setActiveId(featured[(currentIndex + 1) % featured.length].id);
    }, 6500);
    return () => window.clearTimeout(timer);
  }, [currentId, currentVideo, featured]);

  function playNext() {
    if (!currentId || featured.length < 2) return;
    const currentIndex = featured.findIndex((character) => character.id === currentId);
    setHeroProgress(0);
    setActiveId(featured[(currentIndex + 1) % featured.length].id);
  }

  function activateCharacter(characterId: string) {
    setHeroProgress(0);
    setActiveId(characterId);
  }

  if (!characters.length || !currentCharacter) return null;

  return (
    <main
      className="relative min-h-[calc(100dvh-4rem)] overflow-hidden pb-28 pt-16"
      data-home-featured
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_16%,rgba(242,78,112,0.13),transparent_27%),radial-gradient(circle_at_90%_8%,rgba(7,210,190,0.12),transparent_31%)]" />

      <section
        className="relative mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-[96rem] flex-col gap-3 px-3 py-3 sm:px-5 sm:py-5 lg:px-7"
        aria-label="Featured AI actors"
      >
        <article
          className="group relative min-h-[31rem] flex-1 overflow-hidden rounded-xl border border-white/10 bg-[#060b09] shadow-[0_30px_90px_rgba(0,0,0,0.34)] sm:min-h-[34rem] lg:min-h-[32rem]"
          data-featured-stage
          data-featured-character={currentCharacter.id}
        >
          {currentArtwork ? (
            <Image
              key={currentArtwork}
              src={currentArtwork}
              alt={currentCharacter.name}
              fill
              priority
              quality={90}
              sizes="100vw"
              className="object-cover object-center"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(120deg, ${hsl(ARCHETYPE_HUE[currentCharacter.archetype], 52, 20)}, #050807 72%)`,
              }}
            />
          )}

          {currentVideo && (
            <video
              key={`${currentCharacter.id}-${currentVideo}`}
              src={currentVideo}
              poster={currentArtwork ?? undefined}
              autoPlay
              muted
              playsInline
              preload="auto"
              onLoadedMetadata={() => setHeroProgress(0)}
              onTimeUpdate={(event) => {
                const video = event.currentTarget;
                setHeroProgress(video.duration ? video.currentTime / video.duration : 0);
              }}
              onEnded={playNext}
              className="absolute inset-0 h-full w-full object-cover motion-reduce:hidden"
            />
          )}

          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,7,6,0.94)_0%,rgba(2,7,6,0.72)_30%,rgba(2,7,6,0.16)_64%,rgba(2,7,6,0.12)_100%)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/25" />

          <div className="relative z-10 flex h-full min-h-[31rem] max-w-[40rem] flex-col justify-center px-6 py-12 sm:min-h-[34rem] sm:px-10 lg:min-h-[32rem] lg:px-14">
            <p className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.28em] text-accent">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent shadow-[0_0_12px_rgba(242,78,112,0.9)]" />
              Featured performance
            </p>
            <h1 className="reel-title mt-5 text-[clamp(3.2rem,6.5vw,7rem)] leading-[0.82] tracking-[-0.055em] text-white">
              The world of
              <span className="mt-2 block text-accent">AI actors.</span>
            </h1>
            <p className="mt-6 max-w-md text-sm leading-6 text-white/65 sm:text-base sm:leading-7">
              Original actors with locked faces, voices, and worlds—ready for your next{" "}
              <span
                key={CASTING_FORMATS[castingFormatIndex]}
                className="font-semibold text-accent-secondary motion-safe:animate-[chaplin-format-enter_400ms_ease-out]"
              >
                {CASTING_FORMATS[castingFormatIndex]}.
              </span>
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/characters"
                className="rounded-md bg-accent px-5 py-3 text-sm font-bold text-paper shadow-[0_12px_32px_rgba(242,78,112,0.24)] transition-transform hover:-translate-y-0.5"
              >
                Explore actors →
              </Link>
              <Link
                href={`/characters/${currentCharacter.id}`}
                className="rounded-md border border-white/25 bg-black/15 px-5 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:border-accent hover:text-accent"
              >
                Meet {currentCharacter.name.split(" ")[0]} →
              </Link>
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-4 border-t border-white/10 bg-black/30 px-5 py-4 backdrop-blur-md sm:px-8">
            <div className="min-w-0">
              <p className="marquee-title truncate text-lg uppercase leading-none text-white sm:text-xl">
                {currentCharacter.name}
              </p>
              <p className="mt-1 truncate text-[10px] text-white/60">
                {ARCHETYPE_LABEL[currentCharacter.archetype]} · {currentCharacter.tagline}
              </p>
            </div>
            <dl className="hidden shrink-0 items-center gap-7 sm:flex">
              {[
                [characters.length, "Actors"],
                [creatorCount, "Creators"],
                [totalPerformances, "Performances"],
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="text-sm font-semibold text-white">{formatCount(Number(value))}</dt>
                  <dd className="text-[7px] font-semibold uppercase tracking-[0.14em] text-white/45">{label}</dd>
                </div>
              ))}
            </dl>
          </div>

          {currentVideo && (
            <span className="absolute inset-x-0 bottom-0 z-30 h-0.5 overflow-hidden bg-white/10">
              <span
                className="block h-full rounded-r-full bg-accent transition-[width] duration-100"
                style={{ width: `${heroProgress * 100}%` }}
              />
            </span>
          )}
        </article>

        <div className="rounded-xl border border-white/10 bg-black/20 p-3 backdrop-blur-md sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-white/55">
              Featured AI actors
            </p>
            <Link href="/characters" className="text-[9px] font-semibold text-white/50 hover:text-accent">
              View all →
            </Link>
          </div>
          <div className="chaplin-scrollbar flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 lg:grid lg:grid-cols-6 lg:overflow-visible">
            {featured.map((character) => (
              <FeaturedLandscapeCard
                key={character.id}
                character={character}
                active={character.id === currentId}
                onActivate={() => activateCharacter(character.id)}
              />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
