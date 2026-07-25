"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useChaplinStore } from "@/lib/store";
import HeroGridCard, { type HomepageBroll } from "@/components/HeroGridCard";

const CASTING_FORMATS = ["Reels", "Ads", "Micro Drama", "UGC"];

export default function InfiniteCharacterGallery() {
  const characters = useChaplinStore((state) => state.characters);
  const [castingFormatIndex, setCastingFormatIndex] = useState(0);
  const [activeGridId, setActiveGridId] = useState<string | null>(null);
  const [automaticGridId, setAutomaticGridId] = useState<string | null>(null);
  const [brolls, setBrolls] = useState<HomepageBroll[]>([]);

  const brollByCharacter = useMemo(
    () => new Map(brolls.map((broll) => [broll.characterId, broll])),
    [brolls],
  );
  const readyBrollIds = useMemo(
    () => characters
      .filter((character) => brollByCharacter.get(character.id)?.videoUrl || character.videoUrl)
      .map((character) => character.id),
    [brollByCharacter, characters],
  );
  const validAutomaticGridId = automaticGridId && readyBrollIds.includes(automaticGridId)
    ? automaticGridId
    : null;
  const currentFeaturedId = activeGridId ?? validAutomaticGridId ?? readyBrollIds[0] ?? characters[0]?.id;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCastingFormatIndex((current) => (current + 1) % CASTING_FORMATS.length);
    }, 2200);
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


  function advanceBroll(completedCharacterId: string) {
    if (readyBrollIds.length < 2) return;
    const nextIds = readyBrollIds.filter((characterId) => characterId !== completedCharacterId);
    const nextId = nextIds[Math.floor(Math.random() * nextIds.length)];
    setActiveGridId(null);
    setAutomaticGridId(nextId);
  }

  if (!characters.length) return null;
  const totalBaseTiles = characters.length + 1;
  const fillerCount = (8 - (totalBaseTiles % 8)) % 8;
  const repeatedCharacters = Array.from(
    { length: fillerCount },
    (_, index) => characters[index % characters.length],
  );


  return (
    <main className="relative flex h-[calc(100dvh-10rem)] min-h-0 flex-col overflow-hidden" data-home-gallery>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(242,78,112,0.12),transparent_28%),radial-gradient(circle_at_78%_16%,rgba(7,210,190,0.14),transparent_27%)]" />
      <section className="relative mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col px-3 py-2 sm:px-4 sm:py-3 lg:px-6" aria-label="AI actor gallery">
        <div className="mx-auto mb-2 max-w-3xl shrink-0 text-center sm:mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-accent">The Chaplin cast</p>
          <h1 className="marquee-title mt-1 text-[clamp(1.55rem,4.6vh,3.5rem)] uppercase leading-[0.92] text-ink">
            The World of AI Actors
          </h1>
          <p className="mt-1 text-xs leading-5 text-grey sm:text-base" aria-live="polite">
            Ready to cast AI actors for{" "}
            <span
              key={CASTING_FORMATS[castingFormatIndex]}
              className="font-semibold text-accent motion-safe:animate-[chaplin-format-enter_400ms_ease-out]"
            >
              {CASTING_FORMATS[castingFormatIndex]}.
            </span>
          </p>
        </div>

        <div className="grid min-h-0 flex-1 grid-flow-dense grid-cols-4 auto-rows-[minmax(0,1fr)] gap-1.5 sm:grid-cols-8 sm:gap-2" data-home-gallery-grid>
          {characters.map((character) => (
            <HeroGridCard
              key={character.id}
              character={character}
              fillCell
              active={character.id === currentFeaturedId}
              onActivate={() => setActiveGridId(character.id)}
              broll={brollByCharacter.get(character.id)}
              onPlaybackComplete={advanceBroll}
            />
          ))}
          {repeatedCharacters.map((character, index) => (
            <HeroGridCard
              key={`repeat-${character.id}-${index}`}
              character={character}
              active={false}
              onActivate={() => setActiveGridId(character.id)}
              broll={brollByCharacter.get(character.id)}
              fillCell
            />
          ))}
          <Link
            href="/characters/new"
            className="flex h-full min-h-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line p-1.5 text-center text-grey transition-colors hover:border-accent hover:text-accent"
          >
            <span className="text-lg leading-none">+</span>
            <span className="text-[8px] font-semibold leading-tight sm:text-[10px]">Create your AI actor</span>
          </Link>
        </div>

        <div className="mx-auto mt-2 flex w-full shrink-0 items-center justify-between gap-3">
          <p className="text-[9px] text-grey sm:text-[10px]">
            <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-accent-secondary shadow-[0_0_10px_var(--accent-secondary)]" />
            {characters.length} characters ready to discover
          </p>
          <Link
            href="/feed"
            className="rounded-full border border-line bg-paper/65 px-3 py-1.5 text-[9px] font-semibold text-ink backdrop-blur-md transition-colors hover:border-accent hover:text-accent sm:text-[10px]"
          >
            Open Feed →
          </Link>
        </div>
      </section>
    </main>
  );
}
