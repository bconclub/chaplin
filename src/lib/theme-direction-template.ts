/**
 * One global theme direction template, filled per character.
 *
 * The companion to the voice template: the same slots in the same order for
 * every actor, so a change to how Chaplin briefs the music model is one edit
 * here rather than a sweep across archetypes. It also fixes what the old
 * composer sent ElevenLabs - character biography was spliced into the identity
 * line, so the model received a paragraph of narrative psychology where genre,
 * mood, and instrumentation belong. Here the character reading has its own slot
 * and stays out of the musical ones.
 *
 * This module owns the template and nothing else. Slot resolution lives with
 * the production canon in `production-prompting`, so the two never import each
 * other in a cycle and the template stays editable on its own.
 */
export const THEME_DIRECTION_TEMPLATE = `Create a cinematic character theme for {CHARACTER_NAME}.

Genre: {PRIMARY_GENRE} blended with {SECONDARY_GENRE} and modern cinematic trailer scoring.

Mood: {MOOD}.

Character: {CHARACTER_DESCRIPTION}. The music should reflect their personality, motivations, strengths, flaws, and emotional journey without becoming cliché.

Energy Arc:
- Opening: {OPENING_FEEL}
- Build: {BUILD_FEEL}
- Climax: {CLIMAX_FEEL}
- Ending: {ENDING_FEEL}

Production Style:
Ultra-modern, high-end film score production with contemporary electronic textures, organic orchestration, deep cinematic percussion, evolving sound design, powerful low-end, wide stereo imaging, dynamic transitions, and polished mixing suitable for AAA games, blockbuster films, and premium trailers.

Musical Characteristics:
{MUSICAL_CHARACTERISTICS}

Avoid:
Generic royalty-free music, cheesy melodies, repetitive loops, dated synth presets, excessive EDM drops, cartoonish orchestration, muddy mixing, or over-compressed mastering.

Overall Feel:
A memorable signature theme that immediately establishes the identity of {CHARACTER_NAME} while remaining emotionally rich, modern, and cinematic.`;

export type ThemeDirectionSlot =
  | "CHARACTER_NAME"
  | "PRIMARY_GENRE"
  | "SECONDARY_GENRE"
  | "MOOD"
  | "CHARACTER_DESCRIPTION"
  | "OPENING_FEEL"
  | "BUILD_FEEL"
  | "CLIMAX_FEEL"
  | "ENDING_FEEL"
  | "MUSICAL_CHARACTERISTICS";

export type ThemeDirectionSlots = Record<ThemeDirectionSlot, string>;

/**
 * Substitutes every `{SLOT}` token. An unresolved token is a template bug, so it
 * throws rather than shipping a literal `{MOOD}` to a music provider.
 */
export function fillThemeDirectionTemplate(template: string, slots: ThemeDirectionSlots) {
  const filled = template.replace(/\{([A-Z_]+)\}/g, (token, key: string) =>
    key in slots ? slots[key as ThemeDirectionSlot] : token);
  const unresolved = filled.match(/\{[A-Z_]+\}/g);
  if (unresolved) throw new Error(`Theme direction template has unfilled slots: ${unresolved.join(", ")}`);
  return filled;
}

/**
 * The palette carries the family's genre reading as one phrase. The template
 * wants two, so the phrase is split on its own separators rather than inventing
 * a second genre the palette never claimed.
 */
export function splitThemeGenres(genres: string) {
  const parts = genres.split(/,\s*|\s+and\s+/i).map((part) => part.trim()).filter(Boolean);
  return { primary: parts[0] ?? genres, secondary: parts[1] ?? parts[0] ?? genres };
}
