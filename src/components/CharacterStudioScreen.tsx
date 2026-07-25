"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import CharacterProductionStudio from "@/components/CharacterProductionStudio";
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
    <main className="min-h-[calc(100dvh-3.5rem)] bg-[#090d06]">
      <CharacterProductionStudio character={character} onExit={() => router.push(`/characters/${character.id}`)} />
    </main>
  );
}
