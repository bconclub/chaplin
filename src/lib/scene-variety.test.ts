import assert from "node:assert/strict";
import test from "node:test";
import { buildScenePackage, characterSceneOffset } from "@/lib/production-prompting";

const actor = (name: string, archetype: string, tagline: string) => ({
  name,
  archetype,
  tagline,
  personality: `${name} is driven and specific.`,
  voiceGender: "androgynous",
}) as Parameters<typeof buildScenePackage>[0];

const CAST = [
  actor("Rukhsar Ansari", "outsider", "Ninety seconds to sell you the sky."),
  actor("Sprocket", "hero", "Forged in courage, tempered by mercy."),
  actor("Boxer Benson", "hero", "Every bruise is a receipt."),
  actor("Vireo Kess", "superhero", "Every color is a confession."),
  actor("Meher Qureshi", "love-interest", "A Lucknow jewel thief."),
  actor("Astra Sen", "superhero", "She stores the sunrise."),
];

// NOTE: the local fallback only has FOUR authored blueprints, so six actors
// cannot each get a unique scene. These tests assert the regression is gone
// (everyone landing on blueprint 0) and that the pool is used evenly — not
// uniqueness, which the content simply cannot provide.
const BLUEPRINT_COUNT = 4;

test("actors are spread across the blueprint pool instead of all opening on one", () => {
  const scenes = CAST.map((character) => buildScenePackage(character, 0));
  const settings = new Set(scenes.map((scene) => scene.blueprint.setting));
  // A hash over six names will not hit all four buckets evenly; the point is
  // that actors are genuinely spread rather than stacked on one blueprint.
  assert.ok(
    settings.size >= 3,
    `expected actors spread across the pool of ${BLUEPRINT_COUNT}, got only ${settings.size} distinct settings`,
  );

  // The exact regression: blueprint 0's projection-corridor door reaching every
  // actor because buildScenePackage defaulted to index 0 for everyone.
  const doorCount = scenes.filter((scene) => /metal exit door at frame right/i.test(scene.blueprint.setting)).length;
  assert.ok(doorCount < CAST.length, "every actor still opens on the projection-corridor door");
  assert.ok(doorCount <= 2, `the door still dominates: ${doorCount}/${CAST.length} actors`);
});

test("dialogue is no longer identical for every actor", () => {
  const lines = CAST.map((character) => buildScenePackage(character, 0).dialogue);
  assert.ok(
    new Set(lines).size >= 3,
    `expected several distinct lines across the pool of ${BLUEPRINT_COUNT}, got ${new Set(lines).size}: ${JSON.stringify(lines)}`,
  );
  const doorLines = lines.filter((line) => /that door wanted me gone/i.test(line)).length;
  assert.ok(doorLines < CAST.length, "every actor still speaks the door line");
});

test("an actor's own takes stay deterministic and keep cycling", () => {
  const character = CAST[0];
  assert.equal(
    buildScenePackage(character, 0).blueprint.setting,
    buildScenePackage(character, 0).blueprint.setting,
    "same actor + same take must be repeatable",
  );
  assert.notEqual(
    buildScenePackage(character, 0).blueprint.setting,
    buildScenePackage(character, 1).blueprint.setting,
    "consecutive takes must advance",
  );
});

test("the offset is stable for identical identities", () => {
  assert.equal(characterSceneOffset(CAST[0]), characterSceneOffset(CAST[0]));
  assert.notEqual(characterSceneOffset(CAST[0]), characterSceneOffset(CAST[1]));
});
