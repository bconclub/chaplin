"use client";

import Link from "next/link";
import { Fragment, useMemo } from "react";
import type { Character } from "@/lib/types";

function escapeForRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Renders post text with every casting mention turned into a link to that
 * actor's profile. Post bodies carry lines like `Cast: Sprocket, Boxer Benson`,
 * which were rendered as flat text, so a reader could see who was cast but had
 * no way to reach them.
 *
 * Names are matched longest-first so "Rukhsar \"Ru\" Ansari" wins over any
 * shorter name contained inside it, and matching is bounded by non-word
 * characters so a name never matches inside a longer word.
 */
export type BodySegment = { text: string; character: Character | null };

/** Pure segmentation, exported so the matching rules can be tested directly. */
export function segmentBody(body: string, characters: Character[]): BodySegment[] {
  const named = characters.filter((character) => character.name.trim().length > 2);
  if (!body || !named.length) return [{ text: body, character: null }];

  const byLength = [...named].sort((left, right) => right.name.length - left.name.length);
  const pattern = new RegExp(`(?<![\\w])(${byLength.map((c) => escapeForRegex(c.name)).join("|")})(?![\\w])`, "gi");
  const byLowerName = new Map(named.map((character) => [character.name.toLowerCase(), character]));

  const out: BodySegment[] = [];
  let cursor = 0;
  for (const match of body.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) out.push({ text: body.slice(cursor, index), character: null });
    out.push({ text: match[0], character: byLowerName.get(match[0].toLowerCase()) ?? null });
    cursor = index + match[0].length;
  }
  if (cursor < body.length) out.push({ text: body.slice(cursor), character: null });
  return out;
}

export default function FeedBody({ body, characters }: { body: string; characters: Character[] }) {
  const segments = useMemo(() => segmentBody(body, characters), [body, characters]);

  return (
    <p className="mt-2 whitespace-pre-wrap text-[15px] leading-7 text-ink/95">
      {segments.map((segment, index) => (
        <Fragment key={`${index}-${segment.text.slice(0, 8)}`}>
          {segment.character ? (
            <Link
              href={`/characters/${segment.character.id}`}
              onClick={(event) => event.stopPropagation()}
              className="rounded font-semibold text-accent-secondary decoration-accent-secondary/40 underline-offset-2 transition-colors hover:text-accent hover:underline"
            >
              {segment.text}
            </Link>
          ) : (
            segment.text
          )}
        </Fragment>
      ))}
    </p>
  );
}
