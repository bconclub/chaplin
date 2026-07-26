import type { NextRequest } from "next/server";
import { requireRequestIdentity } from "@/lib/server/auth";
import { getSupabaseAdminClient, persistStory } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * Lists the signed-in account's productions.
 *
 * POST persisted the story row, but nothing ever read it back: the Studio
 * Productions tab filtered the client store, which lives in this browser's
 * localStorage. A production started on another device - or after the store was
 * cleared - existed in the database and showed nowhere. Scoped to the session
 * identity rather than a query parameter so one account cannot list another's.
 */
export async function GET(request: NextRequest) {
  try {
    const identity = await requireRequestIdentity(request);
    const result = await getSupabaseAdminClient()
      .from("stories")
      .select("id,title,logline,cover_hue,poster_url,backdrop_url,views,created_at,updated_at")
      .eq("author_id", identity.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (result.error) throw new Error(`Load productions: ${result.error.message}`);
    return Response.json({ stories: result.data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load productions.";
    return Response.json({ error: message }, { status: message === "Sign in to continue." ? 401 : 400 });
  }
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
export async function POST(request: NextRequest) {
  try {
    const input = await request.json() as Record<string, unknown>;
    const id = text(input.id, 120);
    const title = text(input.title, 200);
    if (!id || !title) {
      return Response.json({ error: "A story id and title are required." }, { status: 400 });
    }
    /*
      The session owns authorship. The client sends the store's currentUserId,
      which is the demo "u-creator" until a profile loads, so trusting it filed
      productions under an id the owner's own session never matches - written,
      then invisible. The body value is only a fallback for unauthenticated
      local use.
    */
    const identity = await requireRequestIdentity(request).catch(() => null);
    const story = await persistStory({
      id,
      authorId: identity?.id ?? (text(input.authorId, 120) || null),
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
