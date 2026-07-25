import assert from "node:assert/strict";
import test from "node:test";
import {
  CharacterCardV2Schema,
  assertPromptConsistency,
  buildDialogueSystemPrompt,
  buildIdentitySeedPrompt,
  buildImagePrompt,
  buildVideoPrompt,
  buildVoiceDesignPrompt,
} from "@/lib/character-card";
import { AGNI_MAYA_CARD_V2 } from "@/lib/character-card-fixtures";

test("Agni Maya v2 card validates and has a single active age", () => {
  const card = CharacterCardV2Schema.parse(AGNI_MAYA_CARD_V2);
  assert.equal(card.age_states.filter((state) => state.active).length, 1);
  assert.equal(card.persona_card.dialogue_exemplars.length, 9);
  assert.equal(card.signature_sfx_events?.length, 3);
  assert.deepEqual(card.consumer_tags.signature_sfx_events, ["sfx"]);
});

test("stored v2 cards without atomic SFX events remain valid", () => {
  const { signature_sfx_events: _events, ...legacyCard } = AGNI_MAYA_CARD_V2;
  const card = CharacterCardV2Schema.parse(legacyCard);
  assert.equal(card.signature_sfx_events, undefined);
});

test("image builder injects the identity block verbatim and exactly one wardrobe state", () => {
  const prompt = buildImagePrompt(AGNI_MAYA_CARD_V2, {
    wardrobe_state: "operational",
    scene_beat: "She waits at a locked exit before choosing a direction.",
    setting: "a wet service corridor at night",
    camera: "eye-level 50mm medium close-up",
    light: "tungsten practical with a cool bounce",
  });
  assert.ok(prompt.includes(AGNI_MAYA_CARD_V2.identity_locks.identity_block));
  assert.ok(prompt.includes(AGNI_MAYA_CARD_V2.wardrobe_states.operational.wardrobe));
  assert.ok(!prompt.includes(AGNI_MAYA_CARD_V2.wardrobe_states.domestic.wardrobe));
});

test("identity builder creates a neutral feed seed without a story environment", () => {
  const prompt = buildIdentitySeedPrompt(AGNI_MAYA_CARD_V2);
  assert.ok(prompt.includes(AGNI_MAYA_CARD_V2.identity_locks.identity_block));
  assert.match(prompt, /neutral seamless backdrop/i);
  assert.doesNotMatch(prompt, /wet service corridor|locked exit/i);
});

test("video builder contains only visual continuity, motion, camera, and timing", () => {
  const prompt = buildVideoPrompt(AGNI_MAYA_CARD_V2, {
    scene_beat: "She decides to cross the threshold.",
    motion: "She shifts forward, steadies her hand, and stops before the latch.",
    camera: "slow lateral track",
    timing: "five seconds, settle into stillness",
  });
  assert.ok(prompt.includes(AGNI_MAYA_CARD_V2.identity_locks.identity_block));
  assert.doesNotMatch(prompt, /\b(audio|voice|sfx|music|biography)\b/i);
  assert.doesNotMatch(prompt, new RegExp(AGNI_MAYA_CARD_V2.dramatic_engine.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("voice builder routes only labeled ElevenLabs fields", () => {
  const prompt = buildVoiceDesignPrompt(AGNI_MAYA_CARD_V2);
  assert.match(prompt, /LANGUAGE \/ DIALECT:/);
  assert.match(prompt, /PRESSURE DELIVERY:/);
  assert.doesNotMatch(prompt, /dramatic_engine|story_grammar/i);
});

test("dialogue builder uses persona, contract, and exemplar pairs", () => {
  const prompt = buildDialogueSystemPrompt(AGNI_MAYA_CARD_V2, { setting: "a quiet kitchen", user_role: "a neighbour" }, ["The neighbour returned her brass key."]);
  assert.match(prompt, /\[CHARACTER CARD\]/);
  assert.match(prompt, /\[SCENE CONTRACT\]/);
  assert.match(prompt, /\[FEW-SHOT EXEMPLARS\]/);
  assert.match(prompt, /brass key/);
});

test("consistency guard rejects identity drift in development", () => {
  assert.throws(
    () => assertPromptConsistency("MOTION: she walks forward.", AGNI_MAYA_CARD_V2, "video"),
    /identity_block is missing or altered/,
  );
});
