import assert from "node:assert/strict";
import test from "node:test";
import {
  DIALOGUE_EDGE_PADDING_SECONDS,
  assertDialogueFits,
  checkDialogueFit,
  estimateSpeechSeconds,
  lintAudioScene,
  resolveAudioScene,
  type SceneAudioPlan,
} from "@/lib/audio-scene";

const SEEDANCE_2 = "dreamina-seedance-2-0";
const FALLBACK = "seedance-1-5-pro-251215";

const vantaPlan: SceneAudioPlan = {
  dialogueLine: "You came back for the wrong reason.",
  ambience: "steady rain on tin, distant market hum, neon buzz",
  sfxMoments: [{ description: "servo whir as the shoulder rolls", atSeconds: 2 }],
};

const ambienceOnlyPlan: SceneAudioPlan = {
  ambience: "cold room tone in an empty iron chamber, far-off dripping",
  sfxMoments: [{ description: "chain link settles against the slab", atSeconds: 1.5 }],
};

test("VANTA-9 dialogue shot on Seedance 2.0 rides the locked voice as an audio reference", () => {
  const scene = resolveAudioScene({
    model: SEEDANCE_2,
    generateAudio: true,
    shotDurationSeconds: 4,
    plan: vantaPlan,
    speakerName: "VANTA-9",
    referenceAudioUrl: "https://example.com/locked.mp3",
    delivery: "flat and unhurried, pressure held under the line",
  });

  assert.equal(scene.mode, "native-ref");
  assert.equal(scene.postMix, false);
  assert.equal(scene.requiresOffFaceFraming, false);
  assert.match(scene.block, /\[DIALOGUE\] speaker=VANTA-9; speaks at 0\.5-3\.5s/);
  assert.match(scene.block, /Delivery: flat and unhurried/);
  assert.match(scene.block, /Lip-sync to the provided audio reference/);
  assert.match(scene.block, /\[AMBIENCE\] steady rain on tin/);
  assert.match(scene.block, /\[SFX MOMENTS\] servo whir as the shoulder rolls at 2s/);
  // Path A must not forbid speech - the actor is speaking.
  assert.doesNotMatch(scene.block, /no speech, no dialogue/);
  assert.match(scene.block, /no music, no invented voices, no narration/);
});

test("ambience-only shot forbids speech outright", () => {
  const scene = resolveAudioScene({
    model: SEEDANCE_2,
    generateAudio: true,
    shotDurationSeconds: 4,
    plan: ambienceOnlyPlan,
  });

  assert.equal(scene.mode, "native-ambient");
  assert.equal(scene.postMix, false);
  assert.doesNotMatch(scene.block, /\[DIALOGUE\]/);
  assert.match(scene.block, /\[AUDIO NEGATIVE\].*no speech, no dialogue, no vocal sounds/);
});

test("a dialogue shot on a model without audio reference is post-mixed and framed off-face", () => {
  const scene = resolveAudioScene({
    model: FALLBACK,
    generateAudio: true,
    shotDurationSeconds: 4,
    plan: vantaPlan,
    speakerName: "VANTA-9",
    referenceAudioUrl: "https://example.com/locked.mp3",
  });

  // Voice identity is law: a model that cannot take the locked recording is
  // never asked to voice the actor.
  assert.equal(scene.mode, "native-ambient");
  assert.equal(scene.postMix, true);
  assert.equal(scene.requiresOffFaceFraming, true);
  assert.match(scene.block, /framed off-face/);
  assert.match(scene.block, /under 2s/);
  assert.match(scene.block, /no speech, no dialogue, no vocal sounds/);
  assert.doesNotMatch(scene.block, /Lip-sync/);
});

test("a dialogue shot with no locked render falls back to post-mix rather than inventing a voice", () => {
  const scene = resolveAudioScene({
    model: SEEDANCE_2,
    generateAudio: true,
    shotDurationSeconds: 4,
    plan: vantaPlan,
    speakerName: "VANTA-9",
  });
  assert.equal(scene.mode, "native-ambient");
  assert.equal(scene.postMix, true);
});

test("the silent plate path is unchanged and emits no audio block", () => {
  const scene = resolveAudioScene({
    model: SEEDANCE_2,
    generateAudio: false,
    shotDurationSeconds: 4,
    plan: vantaPlan,
    referenceAudioUrl: "https://example.com/locked.mp3",
  });
  assert.equal(scene.mode, "silent");
  assert.equal(scene.block, "");
});

test("duration math reserves head and tail and rejects a line that would be clipped", () => {
  const window = 4 - DIALOGUE_EDGE_PADDING_SECONDS * 2;
  assert.equal(window, 3);

  const short = checkDialogueFit({ line: "Wait.", shotDurationSeconds: 4 });
  assert.equal(short.fits, true);

  const long = checkDialogueFit({
    line: "You came back for the wrong reason and now every single one of us has to pay for it twice over",
    shotDurationSeconds: 4,
  });
  assert.equal(long.fits, false);
  assert.match(long.fits ? "" : long.error, /only 3\.00s is available/);

  // A measured render supersedes the estimate.
  assert.equal(
    checkDialogueFit({ line: "Wait.", shotDurationSeconds: 4, lineDurationSeconds: 3.4 }).fits,
    false,
  );
  assert.throws(
    () => assertDialogueFits({ line: "Wait.", shotDurationSeconds: 4, lineDurationSeconds: 3.4 }),
    /Shorten the line or lengthen the shot/,
  );
});

test("an over-long line is refused before a Seedance request is built", () => {
  assert.throws(
    () => resolveAudioScene({
      model: SEEDANCE_2,
      generateAudio: true,
      shotDurationSeconds: 4,
      plan: { ...vantaPlan, dialogueLine: "You came back for the wrong reason and now every single one of us has to pay for it twice over, which is exactly what you wanted" },
      referenceAudioUrl: "https://example.com/locked.mp3",
    }),
    /only 3\.00s is available/,
  );
});

test("speech estimation is conservative and empty-safe", () => {
  assert.equal(estimateSpeechSeconds("   "), 0);
  assert.ok(estimateSpeechSeconds("one two three four five") > 1.5);
});

test("no more than two timed effects survive into the block", () => {
  const scene = resolveAudioScene({
    model: SEEDANCE_2,
    generateAudio: true,
    shotDurationSeconds: 4,
    plan: {
      ambience: "wind over open rooftop",
      sfxMoments: [
        { description: "boot scuff", atSeconds: 1 },
        { description: "chain rattle", atSeconds: 2 },
        { description: "door slam", atSeconds: 3 },
      ],
    },
  });
  assert.match(scene.block, /boot scuff at 1s; chain rattle at 2s/);
  assert.doesNotMatch(scene.block, /door slam/);
});

test("L5 rejects biography smuggled into an audio block", () => {
  const scene = resolveAudioScene({
    model: SEEDANCE_2,
    generateAudio: true,
    shotDurationSeconds: 4,
    plan: {
      ambience: "the room remembers his betrayal, low hum of guilt",
      sfxMoments: [],
    },
  });
  const issues = lintAudioScene({ ...scene, hasReferenceAudio: false });
  assert.ok(issues.some((issue) => issue.rule === "L5"));
});

test("L7 forbids music tokens in a video prompt", () => {
  const issues = lintAudioScene({
    block: "[AUDIO SCENE]\n[AMBIENCE] rain, with a swelling orchestral score underneath",
    mode: "native-ambient",
    postMix: false,
    hasReferenceAudio: false,
  });
  assert.ok(issues.some((issue) => issue.rule === "L7"));
});

test("L8 refuses a lip-sync direction with no locked recording attached", () => {
  const issues = lintAudioScene({
    block: "[AUDIO SCENE]\n[DIALOGUE] speaker=VANTA-9; speaks at 0.5-3.5s. Lip-sync to the provided audio reference, which is the actor's locked voice.",
    mode: "native-ambient",
    postMix: false,
    hasReferenceAudio: false,
  });
  assert.ok(issues.some((issue) => issue.rule === "L8"));
});

test("a correctly resolved Path A and Path B shot both lint clean", () => {
  const pathA = resolveAudioScene({
    model: SEEDANCE_2, generateAudio: true, shotDurationSeconds: 4,
    plan: vantaPlan, speakerName: "VANTA-9", referenceAudioUrl: "https://example.com/locked.mp3",
  });
  assert.deepEqual(lintAudioScene({ ...pathA, hasReferenceAudio: true }), []);

  const pathB = resolveAudioScene({
    model: FALLBACK, generateAudio: true, shotDurationSeconds: 4,
    plan: vantaPlan, speakerName: "VANTA-9", referenceAudioUrl: "https://example.com/locked.mp3",
  });
  assert.deepEqual(lintAudioScene({ ...pathB, hasReferenceAudio: true }), []);
});
