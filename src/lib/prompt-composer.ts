import { z } from "zod";

export const promptSlotSchema = z.record(z.string(), z.string().trim().max(6000));
export type PromptSlots = z.infer<typeof promptSlotSchema>;

const DEFAULT_MARKERS = [
  /\bUK or Irish dialect\b/i,
  /\bexplicitly stated\b/i,
  /\{\{[^}]+\}\}/,
  /\[[A-Z][A-Z0-9_ -]{2,}\]/,
];

export function joinPromptList(values: Array<string | undefined>, conjunction = "and") {
  const clean = [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
  if (clean.length < 2) return clean[0] ?? "";
  if (clean.length === 2) return `${clean[0]} ${conjunction} ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")}, ${conjunction} ${clean.at(-1)}`;
}

export function composePromptSlots(
  order: readonly string[],
  input: PromptSlots,
  options: { separator?: string; labelSlots?: boolean } = {},
) {
  const slots = promptSlotSchema.parse(input);
  const separator = options.separator ?? "\n";
  const missing = order.filter((name) => !(name in slots));
  if (missing.length) throw new Error(`Prompt template is missing named slots: ${missing.join(", ")}`);
  const unknown = Object.keys(slots).filter((name) => !order.includes(name));
  if (unknown.length) throw new Error(`Prompt template received unknown slots: ${unknown.join(", ")}`);
  return order
    .map((name) => {
      const value = slots[name]?.trim();
      if (!value) return "";
      return options.labelSlots ? `${name.toUpperCase()}: ${value}` : value;
    })
    .filter(Boolean)
    .join(separator);
}

export function defaultMarkerFailures(prompt: string) {
  return DEFAULT_MARKERS
    .filter((pattern) => pattern.test(prompt))
    .map((pattern) => `Unresolved default marker matched ${pattern.source}`);
}

/** Extract creator intent from an older field that may already contain a provider template. */
export function unwrapLegacyDirection(value: string | undefined, kind: "voice" | "sfx" | "theme") {
  const raw = value?.replace(/\s+/g, " ").trim() ?? "";
  if (!raw) return "";
  if (kind === "voice") {
    const match = raw.match(/(?:Performance direction|Voice direction|Delivery)\s*:\s*([^]+?)(?=(?:Persona|Emotion|Clean close|Studio quality|$))/i);
    return (match?.[1] ?? raw)
      .replace(/^Primary spoken language:[^.]+\.\s*/i, "")
      .replace(/\b(?:UK or Irish dialect|explicitly stated)\b/gi, "")
      .trim();
  }
  if (kind === "sfx") {
    return raw
      .replace(/^Premium cinematic Foley one-shot for [^:]+:\s*/i, "")
      .split(/\b(?:Blend close|Premium cinematic Foley|No repeated|No sequence)\b/i)[0]
      .replace(/^Five seconds?\s*:\s*/i, "")
      .split(/\b(?:then|followed by|after that|next)\b/i)[0]
      .split(/;\s*|\.\s+/)[0]
      .trim();
  }
  const renderedColor = raw.match(/Character-specific (?:cultural or )?acoustic color(?: inside the contemporary production)?\s*:\s*([^]+?)(?=Core palette:|Arrangement:|Production and mix:|Avoid|About \d|Instrumental only|$)/i);
  if (renderedColor?.[1]) return renderedColor[1].trim().replace(/[.\s]+$/, "");
  const labelled = raw.match(/(?:Style anchor|Music direction|Theme direction)\s*:\s*([^]+?)(?=(?:Arrangement|Production|Avoid|About \d|Instrumental only|$))/i);
  const source = labelled?.[1] ?? raw;
  if (/^Original 2020s\b/i.test(source)) return "";
  return source
    .split(/\b(?:Arrangement|Production and mix|Avoid|About \d+\s*seconds?|Instrumental only|Story|Payoff)\s*:/i)[0]
    .replace(/^Original 2020s[^:;.]*[:;.]\s*/i, "")
    .trim();
}
