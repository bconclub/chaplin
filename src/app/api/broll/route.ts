import { getHomepageBrollState, getHomepageSlots } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Slots ship alongside the B-roll so the homepage can honour an admin's
    // curation in the same request it already makes, rather than ranking
    // entirely on its own with no way to promote or pull an actor.
    const [characters, slots] = await Promise.all([
      getHomepageBrollState(),
      getHomepageSlots().catch(() => []),
    ]);
    return Response.json({ characters, slots });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not load B-roll." },
      { status: 500 }
    );
  }
}
