import assert from "node:assert/strict";
import test from "node:test";
import {
  DELIVERY_LOUDNESS_FILTER,
  DELIVERY_LUFS,
  DUCK_UNDER_SPEECH,
} from "@/lib/audio-mix";

test("the theme ducks by exactly 12dB under a speaking actor", () => {
  // -12dB in linear gain. Asserted numerically so a future edit to the
  // constant cannot silently change how far the bed drops.
  assert.ok(Math.abs(DUCK_UNDER_SPEECH - 0.2512) < 0.0001);
  const bed = 0.18;
  assert.ok(Math.abs(bed * DUCK_UNDER_SPEECH - 0.0452) < 0.0005);
});

test("delivery normalises to the streaming loudness reference", () => {
  assert.equal(DELIVERY_LUFS, -14);
  assert.equal(DELIVERY_LOUDNESS_FILTER, "loudnorm=I=-14:TP=-1.5:LRA=11");
});
