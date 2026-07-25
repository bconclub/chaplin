import { composeCharacterInteractionPrompt } from "@/lib/character-system";
import { buildProductionBible } from "@/lib/production-prompting";
import { listCharacters } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 30;

function clean(value: unknown, max = 800) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

function localReply(name: string, message: string, bible: ReturnType<typeof buildProductionBible>) {
  const subject = message.replace(/[?!\.]+$/g, "").trim();
  return [
    `I hear you. ${subject ? `About “${subject}” — ` : ""}${bible.dramatic.externalWant} is still the thing pulling me forward.`,
    `I won't pretend the doubt is gone; ${bible.dramatic.contradiction} is part of how I move through a room.`,
  ].join(" ").slice(0, 480);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const message = clean(body.message);
  if (message.length < 2) return Response.json({ error: "Write something for the actor first." }, { status: 400 });

  let character;
  try {
    character = (await listCharacters()).find((item) => item.id === id);
  } catch {
    return Response.json({ error: "The actor could not be reached right now." }, { status: 503 });
  }
  if (!character) return Response.json({ error: "Actor not found." }, { status: 404 });

  const bible = buildProductionBible(character);
  const fallback = localReply(character.name, message, bible);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

  if (!apiKey) return Response.json({ reply: fallback, provider: "character-local", canSpeak: Boolean(character.voiceId) });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 220,
        thinking: { type: "disabled" },
        system: `${composeCharacterInteractionPrompt(character, bible)}\n\nReply only as the actor, in first person. Be conversational and specific, never narrate an action, never mention a prompt, bible, model, or creator notes. Keep it to one or two short sentences.`,
        messages: [{ role: "user", content: message }],
      }),
      cache: "no-store",
    });
    const data = (await response.json()) as { content?: Array<{ type?: string; text?: string }> };
    const reply = clean(data.content?.find((block) => block.type === "text")?.text, 700);
    if (!response.ok || !reply) throw new Error("Actor response unavailable.");
    return Response.json({ reply, provider: "anthropic", canSpeak: Boolean(character.voiceId) });
  } catch {
    return Response.json({ reply: fallback, provider: "character-local", canSpeak: Boolean(character.voiceId) });
  }
}
