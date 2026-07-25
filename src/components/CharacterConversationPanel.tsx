"use client";

import { useEffect, useRef, useState } from "react";
import type { Character } from "@/lib/types";

type Turn = { role: "user" | "character"; text: string };

const STARTERS = [
  "What are you chasing right now?",
  "What makes you hesitate?",
  "What would you say before the scene starts?",
];

export default function CharacterConversationPanel({ character }: { character: Character }) {
  const [message, setMessage] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [sending, setSending] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [canSpeak, setCanSpeak] = useState(Boolean(character.voiceId));
  const [error, setError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  useEffect(() => () => {
    audioRef.current?.pause();
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
  }, []);

  async function send(nextMessage = message) {
    const text = nextMessage.trim();
    if (!text || sending) return;
    setError("");
    setSending(true);
    setMessage("");
    setTurns((current) => [...current, { role: "user", text }]);
    try {
      const response = await fetch(`/api/characters/${encodeURIComponent(character.id)}/interact`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await response.json() as { reply?: string; error?: string; canSpeak?: boolean };
      if (!response.ok || !data.reply) throw new Error(data.error || "The actor could not answer right now.");
      setCanSpeak(Boolean(data.canSpeak));
      setTurns((current) => [...current, { role: "character", text: data.reply! }]);
    } catch (caught) {
      setTurns((current) => current.slice(0, -1));
      setMessage(text);
      setError(caught instanceof Error ? caught.message : "The actor could not answer right now.");
    } finally {
      setSending(false);
    }
  }

  async function speak(text: string) {
    if (speaking) return;
    setError("");
    setSpeaking(true);
    try {
      const response = await fetch(`/api/characters/${encodeURIComponent(character.id)}/interact/voice`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error || "Voice playback is unavailable.");
      }
      const blob = await response.blob();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      await audio.play();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Voice playback is unavailable.");
    } finally {
      setSpeaking(false);
    }
  }

  const lastReply = [...turns].reverse().find((turn) => turn.role === "character");

  return (
    <section className="overflow-hidden rounded-[22px] border border-accent/35 bg-[radial-gradient(circle_at_top_right,rgba(7,210,190,0.15),transparent_35%),linear-gradient(135deg,rgba(244,72,112,0.1),transparent_55%),#11190d]" data-character-conversation>
      <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-accent-secondary">Live character room</p>
          <h2 className="reel-title mt-1 text-2xl">Talk to {character.name}</h2>
          <p className="mt-1 text-xs text-grey">Ask a question. The reply stays in character, not in the production notes.</p>
        </div>
        <div className="flex flex-wrap gap-2" aria-label={`Conversation starters for ${character.name}`}>
          {STARTERS.map((starter) => (
            <button key={starter} type="button" onClick={() => void send(starter)} disabled={sending} className="rounded-full border border-white/15 px-3 py-1.5 text-[10px] font-semibold text-white/72 transition-colors hover:border-accent hover:text-accent disabled:opacity-40">
              {starter}
            </button>
          ))}
        </div>
      </div>
      <div className="border-t border-white/10 bg-black/15 p-4 sm:p-5">
        {turns.length > 0 && (
          <div className="mb-4 grid gap-2" aria-live="polite">
            {turns.slice(-4).map((turn, index) => (
              <p key={`${turn.role}-${index}-${turn.text.slice(0, 12)}`} className={`max-w-2xl rounded-lg px-3 py-2 text-xs leading-relaxed ${turn.role === "character" ? "bg-accent-secondary/10 text-ink" : "ml-auto bg-white/8 text-white/70"}`}>
                {turn.role === "character" && <span className="mr-2 text-[9px] font-semibold uppercase tracking-wide text-accent-secondary">{character.name}</span>}
                {turn.text}
              </p>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") void send(); }}
            placeholder={`Say something to ${character.name.split(" ")[0]}…`}
            className="min-w-0 flex-1 rounded-sm border border-white/14 bg-black/25 px-3 py-3 text-sm text-ink outline-none transition-colors placeholder:text-grey focus:border-accent"
            aria-label={`Message ${character.name}`}
          />
          <button type="button" onClick={() => void send()} disabled={sending || !message.trim()} className="rounded-sm bg-accent px-5 py-3 text-sm font-semibold text-paper transition-colors hover:bg-accent-light disabled:opacity-40">
            {sending ? "Thinking…" : "Send"}
          </button>
          {lastReply && canSpeak && (
            <button type="button" onClick={() => void speak(lastReply.text)} disabled={speaking} className="rounded-sm border border-accent-secondary/55 px-4 py-3 text-sm font-semibold text-accent-secondary transition-colors hover:bg-accent-secondary/10 disabled:opacity-40">
              {speaking ? "Speaking…" : "Hear reply"}
            </button>
          )}
        </div>
        {error && <p role="status" className="mt-2 text-xs text-amber-300">{error}</p>}
      </div>
    </section>
  );
}
