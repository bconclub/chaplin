"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import CharacterNodeWorkspace from "@/components/CharacterNodeWorkspace";
import { getCharacter } from "@/lib/selectors";
import { useChaplinStore } from "@/lib/store";

export default function CharacterSystemPage() {
  const params = useParams<{ id: string }>();
  const world = useChaplinStore((state) => state);
  const character = getCharacter(world, params.id);

  if (!character) {
    return (
      <main className="mx-auto max-w-xl px-6 py-24 text-center">
        <p className="text-grey">This character system is not available on this device yet.</p>
        <Link href="/characters" className="mt-4 inline-block text-accent">← Return to actors</Link>
      </main>
    );
  }

  return <CharacterNodeWorkspace character={character} />;
}
