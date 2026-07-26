import assert from "node:assert/strict";
import test from "node:test";
import { pivotIndexFor } from "@/components/studio/SceneStudioTimeline";

test("the pivot is the beat the format turns on", () => {
  // A Punch: hook, pressure, the turn, then the choice.
  assert.equal(pivotIndexFor(4), 2);
  // Three beats still turn on the penultimate one.
  assert.equal(pivotIndexFor(3), 1);
  // Two beats turn on the last.
  assert.equal(pivotIndexFor(2), 1);
  // A single beat is its own pivot.
  assert.equal(pivotIndexFor(1), 0);
  // An Episode turns near the middle rather than at the end.
  assert.equal(pivotIndexFor(15), 7);
  // Empty scripts have no pivot to mark.
  assert.equal(pivotIndexFor(0), -1);
});

test("the pivot always lands inside the script", () => {
  for (let beats = 1; beats <= 30; beats += 1) {
    const pivot = pivotIndexFor(beats);
    assert.ok(pivot >= 0 && pivot < beats, `pivot ${pivot} out of range for ${beats} beats`);
  }
});
