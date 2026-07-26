import { listDeliveredCuts } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Finished productions, so a delivered cut can be watched back. */
export async function GET() {
  try {
    return Response.json({ cuts: await listDeliveredCuts() });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not load delivered cuts." },
      { status: 500 },
    );
  }
}
