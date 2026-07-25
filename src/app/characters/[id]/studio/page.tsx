import { notFound } from "next/navigation";
import CharacterStudioScreen from "@/components/CharacterStudioScreen";
import { listCharacters } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";

export default async function CharacterStudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const character = (await listCharacters()).find((item) => item.id === id);
  if (!character) notFound();
  return <CharacterStudioScreen character={character} />;
}
