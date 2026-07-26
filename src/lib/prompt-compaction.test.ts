import assert from "node:assert/strict";
import test from "node:test";
import { compactVisualDirection, requestsStylizedImage } from "@/lib/prompt-compaction";
import { buildShotImagePrompt, buildShotVideoPrompt } from "@/lib/shot-director";

const TWO_HANDER = {
  productionTitle: "Ru versus the Architect",
  productionLogline: "A courier and the man who designed her cage finally meet.",
  scene: {
    setting: "A flooded parking garage beneath the exchange, ankle-deep water",
    objective: "Ru forces the Architect to admit he authorised the purge",
    action: "Ru drives the Architect back against a concrete pillar and pins his forearm",
  },
  sceneIndex: 0,
  sceneCount: 4,
  actorName: "Rukhsar Ansari",
  actors: [
    { name: "Rukhsar Ansari", identity: "scarred left brow, cropped black hair, oil-stained courier jacket" },
    { name: "The Architect", identity: "silver-templed, tailored grey wool, rimless glasses" },
  ],
};

test("compaction never drops the scene, even when far over budget", () => {
  const prompt = buildShotImagePrompt(TWO_HANDER);
  assert.ok(prompt.length > 1800, "fixture must exceed the image budget to exercise compaction");

  const compacted = compactVisualDirection(prompt, "image");

  // The regression: these were silently deleted, leaving only camera/light.
  for (const label of ["SETTING:", "DRAMATIC OBJECTIVE:", "FIRST-FRAME ACTION:", "STORY PROMISE:"]) {
    assert.ok(compacted.includes(label), `${label} must survive compaction`);
  }
  assert.match(compacted, /flooded parking garage/, "the authored location must reach the provider");
  assert.match(compacted, /admit he authorised the purge/, "the authored objective must reach the provider");
});

test("compaction keeps unknown labels rather than discarding them", () => {
  const prompt = [
    `SETTING: ${"a".repeat(400)}`,
    `BRAND NEW LABEL: ${"b".repeat(400)}`,
    `CAMERA: ${"c".repeat(400)}`,
    `EXCLUSIONS: ${"d".repeat(900)}`,
  ].join("\n");
  const compacted = compactVisualDirection(prompt, "image");
  assert.ok(compacted.includes("BRAND NEW LABEL:"), "an unrecognised label must not be dropped");
  assert.ok(compacted.includes("SETTING:"), "story must be retained");
});

test("story lines survive even when they alone exceed the budget", () => {
  const prompt = [
    `SETTING: ${"a".repeat(1500)}`,
    `FIRST-FRAME ACTION: ${"b".repeat(1500)}`,
    `EXCLUSIONS: ${"d".repeat(500)}`,
  ].join("\n");
  const compacted = compactVisualDirection(prompt, "image");
  assert.ok(compacted.includes("SETTING:"));
  assert.ok(compacted.includes("FIRST-FRAME ACTION:"));
  assert.ok(!compacted.includes("EXCLUSIONS:"), "boilerplate yields to story");
});

test("the realism direction is not read as a request for stylized output", () => {
  const realism = "REALISM: Photoreal live-action captured through a physical camera unless the concept explicitly requests animation, manga, illustration, or another stylized medium.";
  assert.equal(requestsStylizedImage(realism), false);
  assert.equal(requestsStylizedImage(buildShotImagePrompt(TWO_HANDER)), false);
});

test("an explicit stylized request is still detected", () => {
  assert.equal(requestsStylizedImage("Render this shot as a 2D anime frame."), true);
  assert.equal(requestsStylizedImage("STYLE: hand-drawn manga panel with screentone."), true);
});

test("a two-hander names both actors, stages them, and forbids blending", () => {
  const prompt = buildShotImagePrompt(TWO_HANDER);
  assert.match(prompt, /CASTING COMPOSITION: Exactly 2 distinct people/);
  assert.match(prompt, /Rukhsar Ansari \(screen-left/);
  assert.match(prompt, /The Architect \(screen-right/);
  assert.match(prompt, /reference image 1/);
  assert.match(prompt, /reference image 2/);
  assert.match(prompt, /Do not merge, blend, average, duplicate, or substitute/);
  assert.match(prompt, /^CONTACT:/m, "physical contact must be directed, not warned about");
});

test("a solo shot keeps the original single-actor grammar", () => {
  const solo = { ...TWO_HANDER, actors: undefined, actorIdentity: "scarred left brow" };
  const prompt = buildShotImagePrompt(solo);
  assert.match(prompt, /ACTOR LOCK: Rukhsar Ansari\. Match the supplied identity reference exactly\./);
  assert.ok(!prompt.includes("CASTING COMPOSITION:"), "solo shots must not gain ensemble staging");
  assert.ok(!prompt.includes("CONTACT:"), "solo shots must not gain contact direction");
});

test("ensemble video keeps every actor present for the full clip", () => {
  const prompt = buildShotVideoPrompt(TWO_HANDER);
  assert.match(prompt, /IDENTITY ANCHOR: Keep all 2 actors present/);
  assert.match(prompt, /Rukhsar Ansari, The Architect/);
  assert.match(prompt, /Never blend two actors into one/);
});
