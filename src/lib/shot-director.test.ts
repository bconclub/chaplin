import assert from "node:assert/strict";
import test from "node:test";
import {
  buildShotImagePrompt,
  buildShotVideoPrompt,
  validateShotSequence,
  type ShotSceneInput,
} from "@/lib/shot-director";

const scenes: ShotSceneInput[] = [
  {
    setting: "INT. COLLAPSED RELAY STATION - DAY",
    objective: "Sprocket reaches the trapped saboteur.",
    action: "Sprocket braces one broken beam with both hands as the saboteur crawls free.",
  },
  {
    setting: "INT. RELAY CONTROL ROOM - CONTINUOUS",
    objective: "The saboteur reveals the transmitter is still armed.",
    action: "The saboteur points to a pulsing transmitter while Sprocket turns toward it.",
  },
  {
    setting: "INT. RELAY CORE - CONTINUOUS",
    objective: "Sprocket chooses mercy over the mission.",
    action: "Sprocket removes the power cell with his right hand and places it beside the saboteur.",
  },
  {
    setting: "EXT. RELAY STATION - DUSK",
    objective: "The choice changes who leaves together.",
    action: "Sprocket and the saboteur cross screen left as the dead relay darkens behind them.",
  },
];

const basePromptInput = {
  productionTitle: "Signal Fracture",
  productionLogline: "A mission turns into a choice between victory and mercy.",
  scene: scenes[1],
  sceneIndex: 1,
  sceneCount: 4,
  format: "punch",
  actorName: "Sprocket",
  actorIdentity: "A cyber-mechanical guardian with a stable blue armored silhouette.",
};

test("four-shot sequence validation requires four complete, distinct authored scenes", () => {
  assert.deepEqual(validateShotSequence(scenes, 4), { valid: true });
  assert.match(validateShotSequence(scenes.slice(0, 3), 4).error ?? "", /exactly 4 authored scenes/i);
  assert.match(validateShotSequence([...scenes.slice(0, 3), scenes[0]], 4).error ?? "", /repeats another scene/i);
  assert.match(
    validateShotSequence([...scenes.slice(0, 3), { setting: "EXT. ROAD", objective: "", action: "" }], 4).error ?? "",
    /needs both a visible objective and a four-second action/i,
  );
});

test("narrative first-frame prompt depicts one authored scene without ad or contact-sheet grammar", () => {
  const prompt = buildShotImagePrompt(basePromptInput);
  assert.match(prompt, /INT\. RELAY CONTROL ROOM - CONTINUOUS/);
  assert.match(prompt, /saboteur points to a pulsing transmitter/i);
  assert.match(prompt, /Represent only this scene's authored setting/i);
  assert.match(prompt, /No split screen, tiled variants, storyboard, contact sheet/i);
  assert.doesNotMatch(prompt, /OFFERING LOCK|business|storefront hero|advertised product/i);
});

test("video prompt animates the exact first frame as a five-second source with a four-second edit point", () => {
  const prompt = buildShotVideoPrompt(basePromptInput);
  assert.match(prompt, /supplied image is the exact first frame/i);
  assert.match(prompt, /usable action lands by four seconds/i);
  assert.match(prompt, /master edit uses the first four seconds/i);
  assert.match(prompt, /--duration 5/);
  assert.match(prompt, /STORY ANCHOR/i);
  assert.doesNotMatch(prompt, /OFFERING ANCHOR/i);
});

test("four takes of one standoff are rejected even when the wording differs", () => {
  // The real failure: one location, one beat, reworded just enough to differ
  // byte for byte, so exact-signature matching passed all four.
  const alley = "INT/EXT. NIGHT MARKET ALLEY - DEAD END - NIGHT";
  const result = validateShotSequence([
    { setting: alley, objective: "Corner the accused man", action: "VANTA-9 advances low through sheeting rain and raises the gunmetal arm at the accused man" },
    { setting: alley, objective: "Corner the accused man again", action: "VANTA-9 advances slowly through the rain and lifts the gunmetal arm toward the accused man" },
    { setting: alley, objective: "Hold the accused man at gunpoint", action: "VANTA-9 steps through rain and holds the gunmetal arm on the accused man" },
    { setting: alley, objective: "Keep the accused man cornered", action: "VANTA-9 moves through the rain and keeps the gunmetal arm raised at the accused man" },
  ], 4);
  assert.equal(result.valid, false);
  assert.match(result.error ?? "", /plays the same beat as scene 1/);
});

test("one location is allowed when the beat actually moves", () => {
  const alley = "INT/EXT. NIGHT MARKET ALLEY - DEAD END - NIGHT";
  const result = validateShotSequence([
    { setting: alley, objective: "Corner the debtor", action: "VANTA-9 advances through sheeting rain and blocks the only exit" },
    { setting: alley, objective: "Read the ledger tattoo", action: "A soaked stray dog knocks a crate; the debtor's sleeve rides up and exposes an inked mark" },
    { setting: alley, objective: "Recognise his own maker's sigil", action: "He lowers the gunmetal arm fully, chest stencil catching the neon as recognition lands" },
    { setting: alley, objective: "Let the debt go unpaid", action: "He unclasps the chain, drops it in a puddle, and walks out of frame leaving the man standing" },
  ], 4);
  assert.equal(result.valid, true);
});
