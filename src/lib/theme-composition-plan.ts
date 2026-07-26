import { z } from "zod";
import { readCharacterCardV2 } from "@/lib/character-card";
import {
  resolveModernThemePalette,
  type CharacterIdentityInput,
} from "@/lib/production-prompting";

export const THEME_PLAN_KINDS = ["ident_8s", "scene_15s"] as const;
export type ThemePlanKind = (typeof THEME_PLAN_KINDS)[number];

const STYLE_WORD_LIMIT = 8;
const STYLE_DIRECTIVE_VERBS = new Set([
  "begin", "begins", "build", "builds", "cut", "cuts", "drop", "drops",
  "end", "ending", "ends", "enter", "enters", "establish", "establishes",
  "fade", "fades", "finish", "finishes", "introduce", "introduces", "land",
  "lands", "move", "moves", "open", "opens", "resolve", "resolves", "rise",
  "rises", "start", "starts", "stop", "stops", "strip", "strips",
]);
const STYLE_FILLER = new Set([
  "a", "an", "and", "as", "at", "by", "for", "from", "in", "into", "of",
  "on", "one", "only", "the", "then", "to", "with",
]);
const SCENE_MOOD_WORDS = new Set([
  "alert", "anxious", "brooding", "calm", "cold", "confident", "controlled",
  "dark", "delicate", "defiant", "eerie", "energetic", "fragile", "gritty",
  "hopeful", "intimate", "melancholic", "mysterious", "ominous", "playful",
  "propulsive", "restrained", "romantic", "tense", "tender", "urgent", "warm",
  "watchful",
]);

const ThemeStyleSchema = z.string().trim().min(2).max(120).superRefine((style, context) => {
  const words = style.split(/\s+/).filter(Boolean);
  if (words.length > STYLE_WORD_LIMIT) {
    context.addIssue({ code: "custom", message: `Style tags may contain at most ${STYLE_WORD_LIMIT} words.` });
  }
  const verb = words.find((word) => STYLE_DIRECTIVE_VERBS.has(word.toLowerCase().replace(/[^a-z]/g, "")));
  if (verb) {
    context.addIssue({ code: "custom", message: `Style tags cannot contain the directive verb "${verb}".` });
  }
  if (/[.!?]/.test(style)) {
    context.addIssue({ code: "custom", message: "Style tags cannot be sentences." });
  }
});

export const ThemeCompositionChunkSchema = z.object({
  text: z.string().trim().regex(
    /^\[[^\]\r\n]{2,80}\]$/,
    "Instrumental chunk text must be one bracketed section name without lyrics.",
  ),
  duration_ms: z.number().int().min(3000).max(120000),
  positive_styles: z.array(ThemeStyleSchema).min(1).max(50),
  negative_styles: z.array(ThemeStyleSchema).max(50).default([]),
  context_adherence: z.enum(["low", "medium", "high"]).default("high"),
});

export const ThemeCompositionPlanSchema = z.object({
  chunks: z.array(ThemeCompositionChunkSchema).min(1).max(30),
});

export type ThemeCompositionPlan = z.infer<typeof ThemeCompositionPlanSchema>;

export function themePlanTargetMilliseconds(kind: ThemePlanKind) {
  return kind === "scene_15s" ? 15000 : 8000;
}

export function themeCompositionPlanSchemaFor(kind: ThemePlanKind) {
  const target = themePlanTargetMilliseconds(kind);
  return ThemeCompositionPlanSchema.superRefine((plan, context) => {
    const total = plan.chunks.reduce((sum, chunk) => sum + chunk.duration_ms, 0);
    if (total !== target) {
      context.addIssue({
        code: "custom",
        path: ["chunks"],
        message: `Chunk durations must total exactly ${target}ms; received ${total}ms.`,
      });
    }
  });
}

function normalizedStyle(value: string) {
  const theoryTag = value.trim().match(/^([A-G](?:#|b)?\s+(?:major|minor)|\d{2,3}\s*BPM)$/i);
  if (theoryTag) return theoryTag[1];
  const words = value
    .replace(/[.!?;:()[\]{}]/g, " ")
    .replace(/[/_]+/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)
    .filter((word) => !STYLE_FILLER.has(word.toLowerCase()))
    .filter((word) => !STYLE_DIRECTIVE_VERBS.has(word.toLowerCase().replace(/[^a-z]/g, "")))
    .slice(0, STYLE_WORD_LIMIT);
  return words.join(" ");
}

function uniqueStyles(values: Array<string | undefined>, forbiddenName?: string) {
  const forbiddenTokens = new Set(
    forbiddenName?.toLowerCase().split(/\s+/).filter((token) => token.length > 2) ?? [],
  );
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value) continue;
    for (const fragment of value.split(/,|;|\band\b|\bbut\b/gi)) {
      const style = normalizedStyle(fragment);
      if (!style) continue;
      const words = style.toLowerCase().split(/\s+/);
      if (words.some((word) => forbiddenTokens.has(word))) continue;
      const key = style.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(style);
    }
  }
  return result;
}

function theoryTags(value: string) {
  const tags: string[] = [];
  const bpm = value.match(/\b([5-9]\d|1\d{2}|2[0-4]\d)\s*BPM\b/i);
  if (bpm) tags.push(`${bpm[1]} BPM`);
  const key = value.match(/\b(?:key\s+of\s+)?([A-G](?:#|b)?\s+(?:major|minor))\b/i);
  if (key) tags.push(key[1]);
  return tags;
}

function sceneMoodTags(sceneBrief: string | undefined) {
  if (!sceneBrief) return [];
  return [...new Set(
    sceneBrief
      .toLowerCase()
      .replace(/[^a-z\s-]/g, " ")
      .split(/\s+/)
      .filter((word) => SCENE_MOOD_WORDS.has(word)),
  )];
}

function assertPlanDevelopmentRules(plan: ThemeCompositionPlan, characterName: string) {
  const styleLists = plan.chunks.flatMap((chunk) => [
    chunk.positive_styles,
    chunk.negative_styles,
  ]);
  for (const styles of styleLists) {
    if (new Set(styles.map((style) => style.toLowerCase())).size !== styles.length) {
      throw new Error("Theme composition plan contains a duplicated style tag.");
    }
  }
  const styles = plan.chunks.flatMap((chunk) => [
    ...chunk.positive_styles,
    ...chunk.negative_styles,
  ]);
  const storyTokens = characterName.toLowerCase().split(/\s+/).filter((token) => token.length > 2);
  const leaked = styles.find((style) =>
    storyTokens.some((token) => new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(style))
  );
  if (leaked) throw new Error("Theme composition styles contain a character-name story token.");
}

export function buildThemePlan(
  character: CharacterIdentityInput,
  kind: ThemePlanKind,
  sceneBrief?: string,
): ThemeCompositionPlan {
  const card = readCharacterCardV2(character.cardV2);
  const profile = card?.theme_profile;
  const palette = resolveModernThemePalette(character);
  const source = [
    profile?.style_anchor,
    profile?.mood,
    ...(profile?.instruments ?? []),
    character.themeDesc,
  ].filter(Boolean).join(" ");
  const positiveGlobal = uniqueStyles([
    profile?.style_anchor,
    character.themeDesc && character.themeDesc.length <= 240 ? character.themeDesc : undefined,
    palette.genres,
    ...(profile?.instruments ?? palette.instruments.slice(0, 3)),
    profile?.mood,
    ...theoryTags(source),
  ], character.name).slice(0, 10);
  const negativeGlobal = uniqueStyles([
    ...(profile?.avoid ?? []),
    "vocals",
    "corporate",
    "trailer orchestral",
    "single-chord vamp",
    "repetitive loop",
    "fade-out",
  ], character.name);
  const moods = sceneMoodTags(sceneBrief);
  const chunk = (
    sectionName: string,
    durationMilliseconds: number,
    positiveLocalStyles: string[],
    negativeLocalStyles: string[],
  ) => ({
    text: `[${sectionName}]`,
    duration_ms: durationMilliseconds,
    // Music v2 has no global-style fields. Repeat the identity palette on each
    // chunk so later sections cannot drift, while the first chunk still sets
    // the overall genre as ElevenLabs recommends.
    positive_styles: uniqueStyles([...positiveGlobal, ...positiveLocalStyles]).slice(0, 50),
    negative_styles: uniqueStyles([...negativeGlobal, ...negativeLocalStyles]).slice(0, 50),
    context_adherence: "high" as const,
  });
  const chunks = kind === "ident_8s"
    ? [
        chunk("hook", 5000, ["dry close identity motif", "rhythmic development"], ["sparse demo"]),
        chunk("ident hit", 3000, ["core motif reduction", "hard clean final hit"], ["fade-out"]),
      ]
    : [
        chunk(
          "establish",
          5000,
          uniqueStyles([...moods, "restrained motif", "clear pulse"]).slice(0, 4),
          ["wall-to-wall density"],
        ),
        chunk(
          "turn",
          5000,
          uniqueStyles([...moods, "harmonic pressure", "rhythmic lift"]).slice(0, 4),
          ["static harmony"],
        ),
        chunk(
          "payoff",
          5000,
          uniqueStyles([...moods, "core motif payoff", "hard clean final hit"]).slice(0, 4),
          ["fade-out"],
        ),
      ];
  const plan = themeCompositionPlanSchemaFor(kind).parse({
    chunks,
  });
  if (process.env.NODE_ENV !== "production") assertPlanDevelopmentRules(plan, character.name);
  return plan;
}

export function buildElevenMusicRequest(input: {
  mode: "composition-plan" | "legacy-prompt";
  modelId: string;
  plan?: ThemeCompositionPlan;
  prompt?: string;
  durationMilliseconds: number;
  forceInstrumental: boolean;
  signWithC2pa: boolean;
}) {
  if (input.mode === "composition-plan") {
    if (!input.plan) throw new Error("Composition-plan mode requires a validated plan.");
    if (input.modelId !== "music_v2") {
      throw new Error("Chunk-based composition plans require the music_v2 model.");
    }
    return {
      composition_plan: input.plan,
      model_id: input.modelId,
      sign_with_c2pa: input.signWithC2pa,
    };
  }
  if (!input.prompt) throw new Error("Legacy prompt mode requires a prompt.");
  return {
    prompt: input.prompt,
    music_length_ms: input.durationMilliseconds,
    model_id: input.modelId,
    force_instrumental: input.forceInstrumental,
    sign_with_c2pa: input.signWithC2pa,
  };
}
