import assert from "node:assert/strict";
import test from "node:test";
import { composeProductImagePrompt, composeProductVideoPrompt, productDialogueAllowlist, type CharacterIdentityInput, type ShotBlueprint } from "@/lib/production-prompting";
import { ProductCardSchema } from "@/lib/product-card";
import { VideoType } from "@/lib/video-brief";

const product = ProductCardSchema.parse({
  brand_name: "Northstar",
  product_name: "Field Flask",
  reference_images: ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"],
  identity_block: "A squat brushed-steel flask with a gently faceted shoulder, a matte black screw cap, and a cobalt enamel band. The NORTHSTAR FIELD FLASK label is printed in white capitals on the front and must remain exactly legible. The proportions, seam, and cap thread are fixed.",
  must_preserve: ["label text exactly 'NORTHSTAR FIELD FLASK'", "matte black cap", "logo never mirrored"],
  negative_prompt: "no warped text, no invented labels, no extra variants, no changed proportions",
  claims_allowed: ["Keeps water cold for approved field use."],
  handling_notes: "Hold the body below the label; twist the cap counter-clockwise and drink only from the open rim.",
});

const actor: CharacterIdentityInput = {
  name: "Mira Sen",
  archetype: "hero",
  tagline: "A careful hand under pressure",
  personality: "observant, practical, and quietly brave",
  voiceGender: "feminine",
};

const shot: ShotBlueprint = {
  sceneName: "Field test",
  dramaticBeat: "Mira reveals the flask after a long walk.",
  hook: "The product catches the first shaft of light.",
  setting: "a bright trailhead",
  subjectStart: "actor lifts the flask from a canvas bag",
  actionTimeline: ["lift", "twist the cap", "offer a sip"],
  facialBeat: "relieved smile",
  framing: "eye-level medium close-up",
  cameraAngle: "handheld eye-level",
  lens: "35mm",
  cameraMovement: "handheld drift",
  keyLight: "natural window light",
  fillAndEdge: "soft sky fill",
  environmentalMotion: "a small breeze moves the strap",
  soundTexture: "cap click",
  musicalArc: "none",
  finalFrame: "label faces camera",
  dialogue: "",
  negative: "no duplicate hands",
};

test("product image grammar keeps identity block, references, claims, and merged negatives", () => {
  const prompt = composeProductImagePrompt({ videoType: VideoType.UgcAd, product, actor, shot, hookText: "Look what I packed.", ctaText: "Pack yours.", personaStyle: "casual" });
  assert.ok(prompt.includes(product.identity_block));
  assert.ok(prompt.includes(product.reference_images[0]));
  assert.ok(prompt.includes(product.claims_allowed[0]));
  assert.match(prompt, /no duplicate hands/);
  assert.match(prompt, /handheld feel/i);
});

test("product hero rejects actors and explicitly forbids humans", () => {
  const prompt = composeProductImagePrompt({ videoType: VideoType.ProductHero, product, shot });
  assert.match(prompt, /no people, faces, hands, or human silhouettes/i);
  assert.match(prompt, /macro/i);
  assert.throws(() => composeProductImagePrompt({ videoType: VideoType.ProductHero, product, actor, shot }), /must never receive actor/i);
});

test("brand spot grammar requires an actor and product", () => {
  const prompt = composeProductVideoPrompt({ videoType: VideoType.BrandSpot, product, actor, shot, narrativeBeat: "reveal" });
  assert.match(prompt, /product enters by shot two/i);
  assert.match(prompt, /final shot is product pack shot with actor/i);
  assert.throws(() => composeProductVideoPrompt({ videoType: VideoType.BrandSpot, product, shot }), /requires an actor/i);
});

test("UGC dialogue allowlist never adds unapproved claims", () => {
  assert.deepEqual(productDialogueAllowlist(product, "Look what I packed.", "Pack yours."), [product.claims_allowed[0], "Look what I packed.", "Pack yours."]);
});
