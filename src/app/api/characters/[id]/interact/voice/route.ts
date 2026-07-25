import { listCharacters } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 700) : "";
  if (!text) return Response.json({ error: "A reply is required." }, { status: 400 });

  const apiKey = process.env.ELEVENLABS_API_KEY ?? process.env.ELEVEN_LABS_API_KEY;
  if (!apiKey) return Response.json({ error: "Voice playback is not configured." }, { status: 503 });

  let character;
  try {
    character = (await listCharacters()).find((item) => item.id === id);
  } catch {
    return Response.json({ error: "The actor could not be reached right now." }, { status: 503 });
  }
  if (!character?.voiceId) return Response.json({ error: "Lock this actor’s voice before playing a live reply." }, { status: 412 });

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(character.voiceId)}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "xi-api-key": apiKey },
      body: JSON.stringify({
        text,
        model_id: "eleven_flash_v2_5",
        voice_settings: { stability: 0.48, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true },
      }),
      cache: "no-store",
    },
  );
  if (!response.ok || !response.body) return Response.json({ error: "Live voice playback is temporarily unavailable." }, { status: 502 });

  return new Response(response.body, {
    headers: { "content-type": response.headers.get("content-type") ?? "audio/mpeg", "cache-control": "no-store" },
  });
}
