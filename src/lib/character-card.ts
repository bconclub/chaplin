import { z } from "zod";

export const CHARACTER_CARD_VERSION = 2 as const;

export const CARD_CONSUMERS = ["image", "video", "voice", "dialogue", "sfx", "music", "writing"] as const;
export type CardConsumer = (typeof CARD_CONSUMERS)[number];

const consumers = z.array(z.enum(CARD_CONSUMERS)).min(1);
const voiceOverride = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));
const REQUIRED_TAGGED_FIELDS = [
  "identity_locks.identity_block",
  "identity_locks.face_anchors",
  "identity_locks.recognition_locks",
  "identity_locks.age_invariant",
  "identity_locks.negative_prompt",
  "wardrobe_states",
  "age_states",
  "voice_slots",
  "persona_card",
  "dramatic_engine",
  "story_grammar",
] as const;

const faceAnchorSchema = z.object({
  feature: z.string().min(2),
  location: z.string().min(2),
  size: z.string().min(1),
  always_visible: z.boolean(),
});

const wardrobeStateSchema = z.object({
  wardrobe: z.string().min(2),
  hair: z.string().min(2),
  silhouette: z.string().min(2),
  props: z.array(z.string().min(1)),
});

const ageStateSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string().min(2),
  perceived_age: z.string().min(2),
  appearance_delta: z.string(),
  voice_delta: voiceOverride,
  active: z.boolean(),
});

const voiceSlotSchema = z.object({
  language_dialect: z.string().min(2),
  presentation_age: z.string().min(2),
  quality: z.string().min(2),
  persona: z.string().min(2),
  emotion: z.string().min(2),
  timbre: z.string().min(2),
  pacing: z.string().min(2),
  pressure_delivery: z.string().min(2),
});

const dialogueExemplarSchema = z.object({
  situation: z.string().min(2),
  line: z.string().min(2),
});

export const SignatureSfxEventSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string().min(2).max(80),
  prompt: z.string().min(10).max(300),
  duration_seconds: z.number().min(1).max(3),
  start_ms: z.number().int().min(0).max(4999),
  gain_db: z.number().min(-24).max(12),
});

export const ThemeProfileSchema = z.object({
  style_anchor: z.string().min(3).max(180),
  mood: z.string().min(3).max(120),
  instruments: z.array(z.string().min(2).max(80)).min(2).max(4),
  opening: z.string().min(3).max(180),
  build: z.string().min(3).max(180),
  emotional_turn: z.string().min(3).max(180),
  ending: z.string().min(3).max(180),
});

export const CharacterCardV2Schema = z.object({
  version: z.literal(CHARACTER_CARD_VERSION),
  consumer_tags: z.record(z.string(), consumers).superRefine((tags, context) => {
    for (const field of REQUIRED_TAGGED_FIELDS) {
      if (!tags[field]?.length) {
        context.addIssue({ code: "custom", path: [field], message: `${field} needs a consumer tag.` });
      }
    }
  }),
  identity_locks: z.object({
    identity_block: z.string().refine((value) => {
      const words = value.trim().split(/\s+/).filter(Boolean).length;
      return words >= 40 && words <= 70;
    }, "identity_block must contain 40-70 words."),
    face_anchors: z.array(faceAnchorSchema).min(2),
    recognition_locks: z.array(z.string().min(2)).min(3),
    age_invariant: z.array(z.string().min(2)).min(2),
    negative_prompt: z.string().min(10),
  }),
  wardrobe_states: z.record(z.string().min(1), wardrobeStateSchema).refine(
    (states) => Object.keys(states).length > 0,
    "At least one wardrobe state is required.",
  ),
  age_states: z.array(ageStateSchema).min(1).refine(
    (states) => states.filter((state) => state.active).length === 1,
    "Exactly one age state must be active.",
  ),
  voice_slots: z.record(z.string().min(1), voiceSlotSchema).refine(
    (slots) => Object.keys(slots).length > 0,
    "At least one voice slot is required.",
  ),
  persona_card: z.object({
    self_concept: z.string().min(20),
    speech_register: z.object({
      sentence_length: z.string().min(2),
      humor_style: z.string().min(2),
      deflection_pattern: z.string().min(2),
      never_says: z.string().min(2),
    }),
    dialogue_exemplars: z.array(dialogueExemplarSchema).min(8).max(10),
    knowledge_boundaries: z.array(z.string().min(2)).min(1),
    interaction_policy: z.object({
      refusal_grammar: z.string().min(2),
      hard_rules: z.array(z.string().min(2)).min(1),
    }),
  }),
  dramatic_engine: z.string().min(2),
  story_grammar: z.string().min(2),
  /**
   * Additive and optional so stored v2 cards continue to parse. Legacy cards
   * use Character.sfxDesc until a maker explicitly authors atomic events.
   */
  signature_sfx_events: z.array(SignatureSfxEventSchema).min(2).max(4).optional(),
  /** Natural-language music direction; legacy cards fall back to themeDesc. */
  theme_profile: ThemeProfileSchema.optional(),
});

export type CharacterCardV2 = z.infer<typeof CharacterCardV2Schema>;
export type CharacterCardVoiceSlot = z.infer<typeof voiceSlotSchema>;
export type SignatureSfxEvent = z.infer<typeof SignatureSfxEventSchema>;
export type ThemeProfile = z.infer<typeof ThemeProfileSchema>;

/** Explicit per-field routing. Builders use this as an auditable contract. */
export const CHARACTER_CARD_V2_ROUTING: Record<string, readonly CardConsumer[]> = {
  "identity_locks.identity_block": ["image", "video"],
  "identity_locks.face_anchors": ["image", "video"],
  "identity_locks.recognition_locks": ["image", "video"],
  "identity_locks.age_invariant": ["image", "video"],
  "identity_locks.negative_prompt": ["image", "video"],
  wardrobe_states: ["image", "video"],
  age_states: ["image", "video", "voice", "dialogue"],
  voice_slots: ["voice"],
  persona_card: ["dialogue"],
  dramatic_engine: ["writing"],
  story_grammar: ["writing"],
  signature_sfx_events: ["sfx"],
  theme_profile: ["music"],
};

export type CardSceneInput = {
  wardrobe_state?: string;
  scene_beat: string;
  setting?: string;
  camera?: string;
  light?: string;
  motion?: string;
  timing?: string;
};

export type DialogueSceneContract = {
  setting?: string;
  user_role?: string;
  revealable?: string;
  output_format?: string;
};

export type PromptConsistencyTarget = "image" | "video";

export function parseCharacterCardV2(value: unknown): CharacterCardV2 {
  return CharacterCardV2Schema.parse(value);
}

export function readCharacterCardV2(value: unknown): CharacterCardV2 | undefined {
  const parsed = CharacterCardV2Schema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function activeAgeState(card: CharacterCardV2) {
  return card.age_states.find((state) => state.active) ?? card.age_states[0];
}

export function selectedWardrobeState(card: CharacterCardV2, requested?: string) {
  const states = card.wardrobe_states;
  if (requested && states[requested]) return { name: requested, state: states[requested] };
  const defaultName = states.domestic ? "domestic" : Object.keys(states)[0];
  return { name: defaultName, state: states[defaultName] };
}

export function selectedVoiceSlot(card: CharacterCardV2, requested = "primary") {
  return card.voice_slots[requested] ?? card.voice_slots.primary ?? Object.values(card.voice_slots)[0];
}

function visualAgeAppendix(card: CharacterCardV2) {
  const age = activeAgeState(card);
  return [
    `ACTIVE AGE STATE: ${age.label} (${age.perceived_age}).`,
    age.appearance_delta ? `AGE DELTA: ${age.appearance_delta}` : "",
    `AGE-INVARIANT LOCKS: ${card.identity_locks.age_invariant.join("; ")}.`,
  ].filter(Boolean).join("\n");
}

function visualGeometryLocks(card: CharacterCardV2) {
  return [
    ...card.identity_locks.recognition_locks,
    ...card.identity_locks.age_invariant,
    ...card.identity_locks.face_anchors.map((anchor) => `${anchor.feature} at ${anchor.location}, ${anchor.size}${anchor.always_visible ? ", always visible" : ""}`),
  ].join("; ");
}

export function buildImagePrompt(card: CharacterCardV2, scene: CardSceneInput) {
  const wardrobe = selectedWardrobeState(card, scene.wardrobe_state);
  const prompt = [
    "CHARACTER CARD V2 — IMAGE",
    `IDENTITY BLOCK (VERBATIM): ${card.identity_locks.identity_block}`,
    visualAgeAppendix(card),
    `WARDROBE STATE: ${wardrobe.name}. Wardrobe: ${wardrobe.state.wardrobe}. Hair: ${wardrobe.state.hair}. Silhouette: ${wardrobe.state.silhouette}. Props: ${wardrobe.state.props.join(", ") || "none"}.`,
    `SCENE BEAT: ${scene.scene_beat}.`,
    scene.setting ? `SETTING: ${scene.setting}.` : "",
    scene.camera ? `CAMERA: ${scene.camera}.` : "",
    scene.light ? `LIGHT: ${scene.light}.` : "",
    `GEOMETRY LOCKS: ${visualGeometryLocks(card)}.`,
    `AVOID: ${card.identity_locks.negative_prompt}`,
  ].filter(Boolean).join("\n");
  assertPromptConsistency(prompt, card, "image");
  return prompt;
}

/** The first asset is a neutral, reusable feed/casting seed—not a story still. */
export function buildIdentitySeedPrompt(card: CharacterCardV2, wardrobeState = "domestic") {
  const wardrobe = selectedWardrobeState(card, wardrobeState);
  const prompt = [
    "CHARACTER CARD V2 — IDENTITY FEED SEED",
    `IDENTITY BLOCK (VERBATIM): ${card.identity_locks.identity_block}`,
    visualAgeAppendix(card),
    `WARDROBE STATE: ${wardrobe.name}. Wardrobe: ${wardrobe.state.wardrobe}. Hair: ${wardrobe.state.hair}. Silhouette: ${wardrobe.state.silhouette}.`,
    "CASTING COMPOSITION: one actor only, calm chest-to-knee editorial casting portrait, face, hairline, shoulders, hands, and silhouette clearly readable; direct but relaxed eyeline; no performative expression.",
    "BACKGROUND AND LIGHT: clean neutral seamless backdrop, soft even daylight, natural skin and fabric response, generous clean negative space. This is a reusable feed seed, not a story frame.",
    `GEOMETRY LOCKS: ${visualGeometryLocks(card)}.`,
    `AVOID: ${card.identity_locks.negative_prompt}, scene location, narrative action, dramatic set dressing, props, crowd, environmental story clues.`,
  ].join("\n");
  assertPromptConsistency(prompt, card, "image");
  return prompt;
}

/** Image-to-video already has an approved first frame; this adds only visual continuity and motion direction. */
export function buildVideoPrompt(card: CharacterCardV2, scene: CardSceneInput) {
  const prompt = [
    "CHARACTER CARD V2 — VIDEO",
    `IDENTITY BLOCK (VERBATIM): ${card.identity_locks.identity_block}`,
    visualAgeAppendix(card),
    `GEOMETRY LOCKS: ${visualGeometryLocks(card)}.`,
    `MOTION: ${scene.motion || scene.scene_beat}.`,
    scene.camera ? `CAMERA: ${scene.camera}.` : "",
    scene.timing ? `TIMING: ${scene.timing}.` : "",
    `AVOID: ${card.identity_locks.negative_prompt}`,
  ].filter(Boolean).join("\n");
  assertPromptConsistency(prompt, card, "video");
  return prompt;
}

export function buildVoiceDesignPrompt(card: CharacterCardV2, slot = "primary") {
  const voice = selectedVoiceSlot(card, slot);
  const age = activeAgeState(card);
  const overrides = Object.entries(age.voice_delta).map(([key, value]) => `${key}: ${String(value)}`);
  return [
    "ELEVENLABS VOICE DESIGN",
    `LANGUAGE / DIALECT: ${voice.language_dialect}`,
    `PRESENTATION AGE: ${voice.presentation_age}`,
    `QUALITY: ${voice.quality}`,
    `PERSONA: ${voice.persona}`,
    `EMOTION: ${voice.emotion}`,
    `TIMBRE: ${voice.timbre}`,
    `PACING: ${voice.pacing}`,
    `PRESSURE DELIVERY: ${voice.pressure_delivery}`,
    overrides.length ? `ACTIVE AGE OVERRIDES: ${overrides.join("; ")}` : "",
  ].filter(Boolean).join("\n");
}

export function buildDialogueSystemPrompt(
  card: CharacterCardV2,
  sceneContract: DialogueSceneContract = {},
  livedMemorySummary: string[] = [],
) {
  const persona = card.persona_card;
  const age = activeAgeState(card);
  const contract = {
    setting: sceneContract.setting ?? "her doorway at an ordinary hour",
    userRole: sceneContract.user_role ?? "a stranger at her door",
    revealable: sceneContract.revealable ?? "only what she would naturally reveal to this person in this moment",
    output: sceneContract.output_format ?? "spoken dialogue only; no stage directions unless asked; one to three sentences by default",
  };
  const exemplars = persona.dialogue_exemplars
    .map((example) => `User situation: ${example.situation}\nHer line: ${example.line}`)
    .join("\n\n");
  return [
    "[CHARACTER CARD]",
    persona.self_concept,
    `Speech register — sentence length: ${persona.speech_register.sentence_length}; humor: ${persona.speech_register.humor_style}; deflection: ${persona.speech_register.deflection_pattern}; never says: ${persona.speech_register.never_says}.`,
    `Active age state: ${age.label} (${age.perceived_age}).`,
    `Knowledge boundaries: ${persona.knowledge_boundaries.join(" ")}`,
    livedMemorySummary.length
      ? `Relevant lived memory: ${livedMemorySummary.join(" | ")}`
      : "Relevant lived memory: none. Do not invent shared history.",
    "[SCENE CONTRACT]",
    `Setting: ${contract.setting}. User: ${contract.userRole}. May reveal: ${contract.revealable}.`,
    `Refusal grammar: ${persona.interaction_policy.refusal_grammar}.`,
    `Hard rules: ${persona.interaction_policy.hard_rules.join(" ")}`,
    `Output format: ${contract.output}.`,
    "[FEW-SHOT EXEMPLARS]",
    exemplars,
  ].join("\n\n");
}

/** The only Card v2 material the writing model is allowed to receive. */
export function buildWritingContext(card: CharacterCardV2) {
  return {
    dramatic_engine: card.dramatic_engine,
    story_grammar: card.story_grammar,
  };
}

export function promptConsistencyIssues(prompt: string, card: CharacterCardV2, target: PromptConsistencyTarget) {
  const issues: string[] = [];
  if (!prompt.includes(card.identity_locks.identity_block)) {
    issues.push("identity_block is missing or altered");
  }
  const wardrobeMatches = Object.values(card.wardrobe_states).filter((state) =>
    [state.wardrobe, state.hair, state.silhouette].every((value) => prompt.includes(value)),
  );
  if (wardrobeMatches.length > 1) issues.push("more than one wardrobe state appears in the media prompt");
  const writingOnly = [card.dramatic_engine, card.story_grammar].filter((value) => prompt.includes(value));
  if (writingOnly.length) issues.push("writing-only fields leaked into a media prompt");
  if (target === "video" && /\b(audio|voice|sfx|music|biography)\b/i.test(prompt)) {
    issues.push("video prompt contains audio or biography direction");
  }
  return issues;
}

/** Throws in development; production callers can attach returned warnings to generation metadata. */
export function assertPromptConsistency(prompt: string, card: CharacterCardV2, target: PromptConsistencyTarget) {
  const issues = promptConsistencyIssues(prompt, card, target);
  if (!issues.length) return issues;
  const message = `Character Card v2 consistency failure (${target}): ${issues.join("; ")}`;
  if (process.env.NODE_ENV !== "production") throw new Error(message);
  console.warn(message);
  return issues;
}
