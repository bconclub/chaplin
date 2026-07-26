import assert from "node:assert/strict";
import test from "node:test";
import { isGenerationVisibleInFeed, isPunchGeneration } from "./feed-visibility";

test("recognizes Punch from the job or persisted metadata", () => {
  assert.equal(isPunchGeneration("character_punch"), true);
  assert.equal(isPunchGeneration(null, { format: "punch" }), true);
  assert.equal(isPunchGeneration("episode", { format: "episode" }), false);
});

test("shows only approved generation categories in the public feed", () => {
  assert.equal(isGenerationVisibleInFeed({ sourceAssetId: "1", assetKind: "theme", mediaKind: "audio" }), true);
  assert.equal(isGenerationVisibleInFeed({ sourceAssetId: "2", assetKind: "dialogue", mediaKind: "audio", videoType: "character_punch" }), true);
  assert.equal(isGenerationVisibleInFeed({ sourceAssetId: "3", assetKind: "dialogue", mediaKind: "audio" }), false);
  assert.equal(isGenerationVisibleInFeed({ sourceAssetId: "4", assetKind: "sfx", mediaKind: "audio" }), false);
  assert.equal(isGenerationVisibleInFeed({ sourceAssetId: "5", assetKind: "voice-design", mediaKind: "audio" }), false);
  assert.equal(isGenerationVisibleInFeed({ sourceAssetId: "6", assetKind: "gallery", mediaKind: "image" }), true);
  assert.equal(isGenerationVisibleInFeed({ sourceAssetId: "7", assetKind: "video", mediaKind: "video" }), true);
});

test("manual audio is hidden because it cannot be verified as a theme or Punch line", () => {
  assert.equal(isGenerationVisibleInFeed({ mediaKind: "audio" }), false);
  assert.equal(isGenerationVisibleInFeed({ mediaKind: "image" }), true);
  assert.equal(isGenerationVisibleInFeed({ mediaKind: null }), true);
});
