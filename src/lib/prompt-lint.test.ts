import assert from "node:assert/strict";
import test from "node:test";
import { buildPromptHandoff } from "@/lib/prompt-handoff";
import { lintPromptHandoff } from "@/lib/prompt-lint";
import { RUKHSAR_RU_FIXTURE } from "@/lib/prompt-lint-fixtures";

test("Ru golden handoff renders source direction once and removes legacy defaults", () => {
  const handoff = buildPromptHandoff(RUKHSAR_RU_FIXTURE, { presentationConfirmed: true });
  const voice = handoff.cards.find((card) => card.id === "voice")!.prompt;
  const sfx = handoff.cards.find((card) => card.id === "sfx")!.prompt;
  const theme = handoff.cards.find((card) => card.id === "theme")!.prompt;
  const runtime = handoff.cards.find((card) => card.id === "master")!.prompt;

  assert.equal((voice.match(/low South London register/gi) ?? []).length, 1, "B1");
  assert.doesNotMatch(voice, /UK or Irish dialect|explicitly stated/i, "B2");
  assert.doesNotMatch(sfx, /Five seconds|then|followed by|after that|next/i, "B3");
  // The theme brief is rendered from the multi-line global template, so this
  // ordering check spans newlines: density negatives, then the duration.
  assert.match(theme, /Avoid [\s\S]+empty intro\.[\s\S]+About 8 seconds, ends cleanly/i, "B4");
  assert.match(runtime, /Self-concept: I am an original rebel/i, "B5");
  assert.doesNotMatch(theme, /mission was a lie|discovers|payoff/i, "B10");
  assert.equal(handoff.lint.failures.length, 0, JSON.stringify(handoff.lint.failures, null, 2));
});

test("linter detects B1-B10 structural failures without an LLM", () => {
  const repeated = "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twentyone";
  const result = lintPromptHandoff({
    canonicalMedium: "photoreal live-action photograph",
    wardrobe: "maroon kurta and olive salwar",
    canonPresentation: "feminine",
    voicePresentation: "androgynous",
    presentationConfirmed: false,
    recognitionLocks: [
      { text: "chipped canine", visibility: "expression", when: "grin" },
      { text: "coin belt", visibility: "framing", when: "full" },
    ],
    artifacts: [
      { id: "voice", consumer: "voice", prompt: `${repeated} ${repeated} UK or Irish dialect. The story discovers a mission.` },
      { id: "sfx", consumer: "sfx", prompt: "Five seconds: coin snaps, then buckle strikes, followed by a heel landing." },
      { id: "theme", consumer: "theme", prompt: "The payoff reveals the betrayal. Avoid generic loops." },
      { id: "identity-still", consumer: "image", prompt: "2D cartoon woman in a coat. Negative: photoreal.", medium: "2D cartoon" },
      { id: "motion", consumer: "video", prompt: "Coat hem moves." },
    ],
  });
  const rules = new Set([...result.failures, ...result.warnings].map((issue) => issue.rule));
  for (const rule of ["L1", "L2", "L4", "L5", "L6", "L7"]) assert.ok(rules.has(rule as never), rule);
  assert.ok(result.durationMs < 100, `lint took ${result.durationMs}ms`);
});
