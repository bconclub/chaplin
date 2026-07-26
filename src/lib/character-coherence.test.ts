import assert from "node:assert/strict";
import test from "node:test";
import {
  coherentGeneratedCharacterName,
  explicitVoiceGender,
  suggestedCharacterName,
} from "@/lib/character-coherence";

test("explicit feminine pronouns produce a feminine progressive-draft name", () => {
  const brief = "Her death ledger remembers every kindness ever done to her.";
  const name = suggestedCharacterName({
    archetype: "hero",
    characterBrief: brief,
    voiceGender: "androgynous",
  });

  assert.equal(explicitVoiceGender(brief), "feminine");
  assert.match(name, /^(Anaya|Ira) /);
  assert.doesNotMatch(name, /^(Veer|Dev) /);
});

test("a conflicting model name is repaired when the creator supplied only a brief", () => {
  const name = coherentGeneratedCharacterName({
    creatorName: "",
    modelName: "Dave Malhotra",
    archetype: "hero",
    characterBrief: "She keeps a death ledger and has never forgiven anyone in her life.",
    voiceGender: "androgynous",
  });

  assert.match(name, /^(Anaya|Ira) /);
  assert.notEqual(name, "Dave Malhotra");
});

test("an explicitly supplied creator name is never rewritten", () => {
  const name = coherentGeneratedCharacterName({
    creatorName: "Dev Malhotra",
    modelName: "Anaya Rao",
    archetype: "hero",
    characterBrief: "She keeps a death ledger.",
    voiceGender: "feminine",
  });

  assert.equal(name, "Dev Malhotra");
});
