import { CHARACTER_CARD_V2_ROUTING, readCharacterCardV2 } from "@/lib/character-card";
import type { Character, CharacterProductionBible } from "@/lib/types";

export type GraphNodeKind = "character" | "source" | "consumer";

export type GraphNode = {
  id: string;
  label: string;
  kind: GraphNodeKind;
  /** Short human sentence: what this actually holds. */
  detail: string;
  /** Present for source nodes: the real value, so the graph shows content not just structure. */
  value?: string;
  /** True when the character has no data for this source yet. */
  empty?: boolean;
};

export type GraphEdge = { from: string; to: string };

export type CharacterGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Sources with no downstream consumer — knowledge that never reaches a prompt. */
  orphans: string[];
};

/** The seven things a character's knowledge can feed. */
const CONSUMERS: Array<{ id: string; label: string; detail: string }> = [
  { id: "consumer:image", label: "Image", detail: "Stills and first frames" },
  { id: "consumer:video", label: "Video", detail: "Motion plates" },
  { id: "consumer:voice", label: "Voice", detail: "The locked voice identity" },
  { id: "consumer:dialogue", label: "Dialogue", detail: "Spoken lines and the character room" },
  { id: "consumer:sfx", label: "SFX", detail: "The signature sound" },
  { id: "consumer:music", label: "Music", detail: "The character theme" },
  { id: "consumer:writing", label: "Writing", detail: "Scenes and story" },
];

function short(value: unknown, max = 150): string | undefined {
  if (typeof value === "string") return value.trim().slice(0, max) || undefined;
  if (Array.isArray(value)) return value.filter(Boolean).map(String).join(" · ").slice(0, max) || undefined;
  if (value && typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>);
    return keys.length ? `${keys.length} entries: ${keys.slice(0, 4).join(", ")}` : undefined;
  }
  return undefined;
}

/**
 * Turns a character's Card V2 and Production Bible into a graph of where every
 * generated asset's context actually comes from.
 *
 * The edges are not invented for display: they are read from
 * CHARACTER_CARD_V2_ROUTING, the same contract the prompt builders enforce. So
 * the picture cannot drift from behaviour — if the graph says persona_card
 * feeds Dialogue and nothing else, that is exactly what the builders do.
 */
export function buildCharacterGraph(character: Character): CharacterGraph {
  const card = readCharacterCardV2(character.cardV2);
  const bible = character.productionBible as CharacterProductionBible | undefined;

  const nodes: GraphNode[] = [
    {
      id: "character",
      label: character.name,
      kind: "character",
      detail: `${character.archetype} · every prompt starts here`,
    },
    ...CONSUMERS.map((consumer) => ({ ...consumer, kind: "consumer" as const })),
  ];
  const edges: GraphEdge[] = [];

  // ---- Card V2 sources, routed by the real contract -------------------------
  const cardSources: Array<{ path: string; label: string; detail: string; value?: string }> = [
    { path: "identity_locks.identity_block", label: "Identity block", detail: "The 40-70 word description every image repeats verbatim", value: short(card?.identity_locks?.identity_block) },
    { path: "identity_locks.face_anchors", label: "Face anchors", detail: "Features that must stay recognisable", value: short(card?.identity_locks?.face_anchors?.map((a) => a.feature)) },
    { path: "identity_locks.recognition_locks", label: "Recognition locks", detail: "What makes them them at a glance", value: short(card?.identity_locks?.recognition_locks) },
    { path: "identity_locks.age_invariant", label: "Age invariants", detail: "True at any age", value: short(card?.identity_locks?.age_invariant) },
    { path: "identity_locks.negative_prompt", label: "Negative prompt", detail: "What must never appear", value: short(card?.identity_locks?.negative_prompt) },
    { path: "wardrobe_states", label: "Wardrobe states", detail: "One look per situation", value: short(card?.wardrobe_states) },
    { path: "age_states", label: "Age states", detail: "How they read at each age", value: short(card?.age_states?.map((a) => a.label)) },
    { path: "voice_slots", label: "Voice slots", detail: "Language, timbre, pacing, pressure", value: short(card?.voice_slots) },
    { path: "persona_card", label: "Persona card", detail: "How they speak, what they never say", value: short(card?.persona_card?.self_concept) },
    { path: "dramatic_engine", label: "Dramatic engine", detail: "What drives them — writing only", value: short(card?.dramatic_engine) },
    { path: "story_grammar", label: "Story grammar", detail: "How their stories are shaped — writing only", value: short(card?.story_grammar) },
    { path: "signature_sfx_events", label: "Signature SFX", detail: "Their sound", value: short(card?.signature_sfx_events?.map((e) => e.label)) },
    { path: "theme_profile", label: "Theme profile", detail: "Mood, instruments, arc", value: short(card?.theme_profile?.mood) },
  ];

  for (const source of cardSources) {
    const consumers = CHARACTER_CARD_V2_ROUTING[source.path] ?? [];
    const id = `card:${source.path}`;
    nodes.push({
      id, label: source.label, kind: "source",
      detail: source.detail, value: source.value, empty: !source.value,
    });
    edges.push({ from: "character", to: id });
    for (const consumer of consumers) edges.push({ from: id, to: `consumer:${consumer}` });
  }

  // ---- Production Bible sources --------------------------------------------
  // The bible has no formal routing contract, so these edges reflect what the
  // prompt builders in production-prompting.ts actually consume.
  const bibleSources: Array<{ key: string; label: string; detail: string; value?: string; to: string[] }> = [
    { key: "dramatic", label: "Dramatic core", detail: "Want, need, contradiction, stakes", value: short(bible?.dramatic?.contradiction), to: ["writing", "dialogue"] },
    { key: "performance", label: "Performance", detail: "Resting face, pressure, gesture, tempo", value: short(bible?.performance?.underPressure), to: ["video", "voice", "dialogue"] },
    { key: "visual", label: "Visual canon", detail: "Face anchors, wardrobe, palette, continuity", value: short(bible?.visual?.wardrobe), to: ["image", "video"] },
    { key: "cinematography", label: "Cinematography", detail: "Framing, height, lens, light", value: short(bible?.cinematography?.lens), to: ["image", "video"] },
    { key: "story", label: "Story patterns", detail: "Hook, escalation, cliffhanger, payoff", value: short(bible?.story?.hookPattern), to: ["writing"] },
  ];

  for (const source of bibleSources) {
    const id = `bible:${source.key}`;
    nodes.push({
      id, label: source.label, kind: "source",
      detail: source.detail, value: source.value, empty: !source.value,
    });
    edges.push({ from: "character", to: id });
    for (const consumer of source.to) edges.push({ from: id, to: `consumer:${consumer}` });
  }

  const consumed = new Set(edges.filter((e) => e.to.startsWith("consumer:")).map((e) => e.from));
  const orphans = nodes
    .filter((node) => node.kind === "source" && !consumed.has(node.id))
    .map((node) => node.label);

  return { nodes, edges, orphans };
}
