"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import CharacterProductionStudio from "@/components/CharacterProductionStudio";
import Avatar from "@/components/Avatar";
import { useChaplinStore } from "@/lib/store";
import type { Character } from "@/lib/types";

export default function CharacterStudioScreen({ character }: { character: Character }) {
  const router = useRouter();
  const activeRole = useChaplinStore((state) => state.activeRole);
  const currentUserId = useChaplinStore((state) => state.currentUserId);
  const canProduce = activeRole === "admin" || (activeRole === "maker" && character.makerId === currentUserId);

  if (!canProduce) {
    return (
      <main className="mx-auto flex min-h-[70dvh] max-w-2xl flex-col items-center justify-center px-6 text-center">
        <p className="text-sm font-semibold">This production room belongs to {character.name}&apos;s maker.</p>
        <Link href={`/characters/${character.id}`} className="mt-4 text-sm font-semibold text-accent hover:underline">
          Back to {character.name}
        </Link>
      </main>
    );
  }

  return (
    <main className="studio-shell h-[100dvh] overflow-hidden bg-[#070a08]" data-character-studio-shell>
      <header className="studio-shell__bar flex h-16 shrink-0 items-center justify-between gap-4 border-b border-white/10 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={() => router.push(`/characters/${character.id}`)} className="rounded-md border border-white/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-grey hover:border-accent hover:text-ink">
            ← Actor
          </button>
          <span className="hidden h-6 w-px bg-white/10 sm:block" />
          <div className="flex min-w-0 items-center gap-2">
            <Avatar hue={character.avatarHue} label={character.name} src={character.imageUrl} size={30} />
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold">{character.name}</span>
              <span className="block text-[9px] uppercase tracking-[0.14em] text-emerald-400">Production studio · autosaved</span>
            </span>
          </div>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <span className="rounded-md border border-white/10 px-3 py-2 text-[10px] font-semibold text-grey">Private workspace</span>
          <button type="button" onClick={() => router.push(`/characters/${character.id}`)} className="rounded-md bg-accent px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-paper hover:bg-accent-light">
            Finish scene
          </button>
        </div>
      </header>
      <CharacterProductionStudio character={character} onExit={() => router.push(`/characters/${character.id}`)} />
    </main>
  );
}
