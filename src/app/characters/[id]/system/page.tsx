import { notFound, redirect } from "next/navigation";
import CharacterNodeWorkspace from "@/components/CharacterNodeWorkspace";
import { getServerAuthIdentity } from "@/lib/server/auth";
import { listCharacters } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";

export default async function CharacterSystemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const identity = await getServerAuthIdentity();
  if (identity?.role !== "admin") {
    redirect(`/admin/login?next=${encodeURIComponent(`/characters/${id}/system`)}`);
  }

  const characters = await listCharacters();
  const character = characters.find((item) => item.id === id);
  if (!character) notFound();

  return <CharacterNodeWorkspace character={character} />;
}
