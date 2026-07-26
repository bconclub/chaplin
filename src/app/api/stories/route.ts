import { persistStory } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * Persists a production's story row.
 *
 * Stories were only ever created in the client store, so a pipeline run was
 * started against a story id the database had never seen. The run row existed
 * with its full script in `spec`, the story did not, and Productions - which
 * reads from the database - showed nothing. Called when a production starts so
 * the run always points at a row that exists.
 */
export async function POST(request: Request) {
  try {
    const input = await request.json() as Record<string, unknown>;
    const id = text(input.id, 120);
    const title = text(input.title, 200);
    if (!id || !title) {
      return Response.json({ error: "A story id and title are required." }, { status: 400 });
    }
    const story = await persistStory({
      id,
      authorId: text(input.authorId, 120) || null,
      title,
      logline: text(input.logline, 2000),
      coverHue: Number.isFinite(Number(input.coverHue)) ? Number(input.coverHue) : 205,
      backdropUrl: text(input.backdropUrl, 1000) || null,
      posterUrl: text(input.posterUrl, 1000) || null,
    });
    return Response.json({ story }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the story.";
    return Response.json({ error: message }, { status: /required|invalid/i.test(message) ? 400 : 500 });
  }
}
