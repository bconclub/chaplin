/**
 * Provider prompt compaction.
 *
 * Image and video providers cap prompt length, so long director prompts must be
 * shortened before they are sent. The previous implementation kept an allow-list
 * of labels and silently dropped every line whose label was not on it. Because
 * `shot-director.ts` emits a different vocabulary (SETTING, DRAMATIC OBJECTIVE,
 * FIRST-FRAME ACTION, STORY PROMISE, ACTOR LOCK) than the allow-list contained,
 * the entire scene was deleted before reaching the provider and every still
 * rendered as a generic actor portrait.
 *
 * Tiers invert that failure mode: an unrecognised label is *kept*, and only
 * boilerplate is sacrificed when the budget is tight.
 */

/** The scene itself. Never dropped — without these the provider has no story. */
export const STORY_LABELS = new Set([
  "PURPOSE", "SHOT UNIT", "STORY PROMISE", "SETTING", "SCENE BEAT", "SHOT",
  "DRAMATIC OBJECTIVE", "DRAMATIC MOMENT", "PLAYABLE MOMENT", "INTENT",
  "FIRST-FRAME ACTION", "MOTION", "ESTABLISH", "PERFORM", "LAND", "TIMING",
  "CASTING COMPOSITION", "CONTACT", "DISTINCT SHOT RULE", "SINGLE-FRAME RULE",
  "STORY EVIDENCE", "STORY ANCHOR", "FINAL FRAME", "WORLD", "SET",
]);

/** Who is in frame. Dropped only after craft detail is already gone. */
export const IDENTITY_LABELS = new Set([
  "STYLE", "ACTOR", "ACTOR LOCK", "ACTOR CANONICAL REFERENCE", "SUBJECT",
  "SUBJECT AND IDENTITY", "IDENTITY ANCHOR", "IDENTITY SOURCE",
  "RECOGNITION LOCKS", "FOUR RECOGNITION LOCKS", "VISIBLE PERSONALITY",
  "VISIBLE PERFORMANCE", "PERFORMANCE LOGIC", "SIGNATURE LOOK", "WARDROBE",
  "WARDROBE STATE", "AGE STATE", "PRODUCT LOCK", "PRODUCT ANCHOR",
]);

/** Trimmed first: the provider negative prompt already carries this material. */
export const BOILERPLATE_LABELS = new Set([
  "EXCLUSIONS", "EXCLUDE", "NEGATIVE", "LOCKS AND EXCLUSIONS", "LOCKS", "AVOID",
  "QUALITY", "EDIT HANDLE", "PHYSICS", "SIMPLIFY BEFORE RENDER", "DIRECTOR CHECK",
  "AUDIO",
]);

const LABEL_PATTERN = /^([A-Z][A-Z /&+_-]{2,32}):\s*(.+)$/;

export function compactionTier(label: string | null) {
  if (label && STORY_LABELS.has(label)) return 0;
  if (label && IDENTITY_LABELS.has(label)) return 1;
  if (label && BOILERPLATE_LABELS.has(label)) return 3;
  return 2;
}

export function compactVisualDirection(prompt: string, kind: "image" | "video") {
  const cleaned = prompt
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const maximumCharacters = kind === "image" ? 1800 : 1450;
  const direct = cleaned.join("\n");
  if (direct.length <= maximumCharacters) return direct;

  const maximumLine = kind === "image" ? 190 : 170;
  const seen = new Set<string>();
  const entries = cleaned.flatMap((line, index) => {
    const match = LABEL_PATTERN.exec(line);
    const label = match ? match[1].trim() : null;
    // Duplicate labels repeat direction without adding information.
    if (label) {
      if (seen.has(label)) return [];
      seen.add(label);
    }
    const tier = compactionTier(label);
    // Story lines keep their full text; everything else may be clipped.
    const text = tier === 0
      ? line
      : label
        ? `${label}: ${match![2].trim().slice(0, maximumLine).trim()}`
        : line.slice(0, maximumLine).trim();
    return [{ index, tier, text }];
  });

  const kept = new Set<number>();
  let used = 0;
  for (const tier of [0, 1, 2, 3]) {
    for (const entry of entries) {
      if (entry.tier !== tier) continue;
      const cost = entry.text.length + 1;
      // Story survives even if it alone exceeds the budget; nothing else does.
      if (tier > 0 && used + cost > maximumCharacters) continue;
      kept.add(entry.index);
      used += cost;
    }
  }

  // Emit in the author's original order so the prompt still reads as direction.
  return entries
    .filter((entry) => kept.has(entry.index))
    .map((entry) => entry.text)
    .join("\n")
    .trim();
}

/**
 * Clauses that merely *mention* stylized media in order to rule them out. The
 * realism direction says "…unless the concept explicitly requests animation,
 * manga, illustration…", which a trailing-3-word negation guard read as a
 * request for animation — flipping photoreal shots into stylized mode and
 * dropping the realism negative from the exclusions.
 */
const STYLE_NEGATION_CUE = /\b(?:no|not|never|avoid|without|exclude|excluding|unless|rather than|instead of|other than|non)\b/i;
const STYLE_DIRECTIVE_LABEL = /^\s*(?:REALISM|OUTPUT MEDIUM|EXCLUDE|EXCLUSIONS?|NEGATIVE|LOCKS(?: AND EXCLUSIONS)?)\b/i;
const STYLE_PATTERN = /\b(?:cartoon|anime|manga|animation|animated|illustration|illustrated|digital painting|3d render|cgi|game art|comic(?:-book)?|claymation)\b/i;

export function requestsStylizedImage(prompt: string) {
  return prompt.split(/[\n.!?;]/).some((clause) => {
    const match = STYLE_PATTERN.exec(clause);
    if (!match) return false;
    if (/\b(?:locks?|exclusions?|negative prompt)\b/i.test(clause)) return false;
    // A clause under a realism/exclusion heading never requests a style.
    if (STYLE_DIRECTIVE_LABEL.test(clause)) return false;
    return !STYLE_NEGATION_CUE.test(clause.slice(0, match.index));
  });
}
