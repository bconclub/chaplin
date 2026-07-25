import {
  planCameraForScene,
  type CameraMovementId,
  type CameraPlan,
} from "@/lib/camera-movements";

export type ShotSceneInput = {
  setting?: string;
  objective?: string;
  action?: string;
  cameraMovementId?: CameraMovementId;
};

export type ShotPromptInput = {
  productionTitle: string;
  productionLogline?: string;
  scene: ShotSceneInput;
  sceneIndex: number;
  sceneCount: number;
  format?: string;
  actorName: string;
  actorIdentity?: string;
  productName?: string;
  hasProductReference?: boolean;
  continuityNote?: string;
};

export type ShotSequenceValidation = {
  valid: boolean;
  error?: string;
};

export const SHOT_KNOWLEDGE_BASE = {
  foundation: [
    "Lock cast, product, hero props, location, runtime, and shot count before generation.",
    "Treat the approved image as the binding first frame and visual source of truth.",
    "Use one generated clip for one shot. Put cuts in the edit, not inside a four-second generation.",
    "Prefer short, direct, intentional instructions over ornate prose.",
  ],
  image: [
    "Design the first frame around one readable dramatic decision, not a biography or mood board.",
    "Show face, hands, important prop or product, environment, and usable negative space for the planned motion.",
    "Match reference lighting to the intended scene; flat or cinematic reference light transfers more reliably than bright studio light.",
    "Use separate product coverage for full shape and label detail when both are critical.",
    "Generate a new reference still for every materially different camera angle rather than asking video to invent it mid-shot.",
  ],
  video: [
    "Animate one subject action, one facial beat, one camera path, and one final landing.",
    "Use timestamped phases: establish, perform, land.",
    "State who owns, holds, touches, or operates every moving prop; never leave object contact implicit.",
    "Preserve screen direction, subject position, background geography, and subject-to-object relationships between adjacent shots.",
    "Keep the supplied frame's face, wardrobe, set, product, palette, lighting logic, lens character, horizon, and object count locked.",
    "Generate picture silently; dialogue, effects, room tone, and music remain separate controllable layers.",
  ],
  limitations: [
    "Avoid crowds performing many independent actions; replace them with one lead action and restrained background reactions.",
    "Avoid multi-person physical contact, intricate hand choreography, liquid transfers, and mechanical transformations unless isolated into their own shot.",
    "Avoid camera teleportation, multiple cuts, new angles, new subjects, new props, or environments not established in the first frame.",
    "Do not ask the model to reveal an unseen asymmetric detail without explicitly anchoring what must appear.",
  ],
  continuity: [
    "Anchor exact identity, distinguishing asymmetry, wardrobe materials, hero props, product geometry, and persistent marks.",
    "Carry forward a successful frame as the next shot's spatial reference whenever positions matter.",
    "Record left-to-right or right-to-left travel and never reverse it accidentally between shots.",
    "Keep product label, cap, silhouette, proportions, colors, materials, and hand contact stable.",
  ],
  negative: [
    "No identity drift, beautification, age shift, body morphing, duplicate person, or costume redesign.",
    "No floating props, detached hands, extra fingers, merged bodies, disappearing products, relabeled packaging, or background rebuild.",
    "No subtitles, captions, UI, logo, watermark, unintended speech, lip-sync, music, or new sound source.",
  ],
  review: [
    "Judge each generated shot by usable ranges, not all-or-nothing success.",
    "Regenerate only the missing bridge or failed action instead of the complete sequence.",
    "A clean crop may hide a peripheral defect; flipping is allowed only when labels, handedness, and geography remain correct.",
    "Sound bridges can begin before a cut and continue across it to make independently generated shots feel continuous.",
  ],
} as const;

export type ShotRisk = {
  code: "crowd" | "multi-cut" | "complex-contact" | "screen-direction" | "prop-contact";
  message: string;
};

export function auditShotScene(scene: ShotSceneInput): ShotRisk[] {
  const text = `${scene.objective ?? ""} ${scene.action ?? ""}`.toLowerCase();
  const risks: ShotRisk[] = [];
  if (/\b(crowd|dozens|hundreds|everyone|mob)\b/.test(text) && /\b(run|fight|shout|point|dance|attack|move)\b/.test(text)) {
    risks.push({ code: "crowd", message: "Reduce the crowd to restrained background reactions and one lead action." });
  }
  if (/\b(cut to|montage|meanwhile|then we see|another angle)\b/.test(text)) {
    risks.push({ code: "multi-cut", message: "Split every camera cut into its own four-second scene." });
  }
  if (/\b(pour|pushes? .* apart|wrestle|grabs? .* from|passes? .* to|handshake)\b/.test(text)) {
    risks.push({ code: "complex-contact", message: "Isolate the physical contact and state exact hands, objects, and positions." });
  }
  if (/\b(left to right|right to left|screen left|screen right)\b/.test(text) === false && /\b(walk|run|cross|drive|moves?)\b/.test(text)) {
    risks.push({ code: "screen-direction", message: "Lock left-to-right or right-to-left travel for continuity." });
  }
  if (/\b(pen|bottle|glass|phone|tool|weapon|product|prop)\b/.test(text) && !/\b(left hand|right hand|both hands|holds?|grips?|touches?|rests? in|attached to)\b/.test(text)) {
    risks.push({ code: "prop-contact", message: "State exactly who holds or touches the important object and with which hand." });
  }
  return risks;
}

export function cameraPlanForShot(input: ShotPromptInput): CameraPlan {
  return planCameraForScene({
    movementId: input.scene.cameraMovementId,
    setting: input.scene.setting,
    objective: input.scene.objective,
    action: input.scene.action,
    format: input.format,
    sceneIndex: input.sceneIndex,
    sceneCount: input.sceneCount,
  });
}

function normalizedSceneSignature(scene: ShotSceneInput) {
  return [scene.setting, scene.objective, scene.action]
    .map((value) => value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "")
    .join("|");
}

export function validateShotSequence(
  scenes: ShotSceneInput[],
  expectedCount: number,
): ShotSequenceValidation {
  if (scenes.length !== expectedCount) {
    return {
      valid: false,
      error: `This production needs exactly ${expectedCount} authored scenes. It currently has ${scenes.length}.`,
    };
  }

  const incompleteIndex = scenes.findIndex((scene) => !scene.objective?.trim() || !scene.action?.trim());
  if (incompleteIndex >= 0) {
    return {
      valid: false,
      error: `Scene ${incompleteIndex + 1} needs both a visible objective and a four-second action before rendering.`,
    };
  }

  const signatures = scenes.map(normalizedSceneSignature);
  const repeatedIndex = signatures.findIndex((signature, index) => (
    signature.length > 2 && signatures.indexOf(signature) !== index
  ));
  if (repeatedIndex >= 0) {
    return {
      valid: false,
      error: `Scene ${repeatedIndex + 1} repeats another scene. Give every shot its own setting, objective, or visible action.`,
    };
  }

  return { valid: true };
}

export function buildShotImagePrompt(input: ShotPromptInput): string {
  const camera = cameraPlanForShot(input);
  const risks = auditShotScene(input.scene);
  return [
    `PURPOSE: Binding first frame for scene ${input.sceneIndex + 1} of ${input.sceneCount} in "${input.productionTitle}".`,
    "SHOT UNIT: This image is the exact visual start of one four-second clip. It is not a portrait, poster, montage, or finished edit.",
    `STORY PROMISE: ${input.productionLogline || "Make the scene's visible change clear without explanatory text."}`,
    `SETTING: ${input.scene.setting || "A specific location grounded in the locked production."}`,
    `DRAMATIC OBJECTIVE: ${input.scene.objective || "Create one visible situation change."}`,
    `FIRST-FRAME ACTION: Compose the instant immediately before ${input.scene.action || `${input.actorName} begins one concise, camera-readable action.`}`,
    "DISTINCT SHOT RULE: Represent only this scene's authored setting, objective, and starting action. Do not copy the pose, staging, camera angle, or background of another scene in the sequence.",
    "SINGLE-FRAME RULE: Return one full-bleed camera view only. No split screen, tiled variants, storyboard, contact sheet, diptych, triptych, or collage.",
    `ACTOR LOCK: ${input.actorName}. Match the supplied identity reference exactly. ${input.actorIdentity ?? ""}`.trim(),
    ...(input.hasProductReference
      ? [`PRODUCT LOCK: The supplied ${input.productName || "product"} reference is binding. Preserve exact silhouette, packaging, label placement, proportions, colors, cap, and materials. Keep it readable at its real scale.`]
      : ["STORY EVIDENCE: Show only the physical evidence required by this scene's action and objective. Do not invent a product, storefront, service demonstration, or advertising setup that is absent from the script. Never return an empty portrait-only frame."]),
    `CAMERA: ${camera.angle}; ${camera.lens}. Compose enough space for ${camera.movementName}: ${camera.movementPrompt}`,
    "COMPOSITION: Show the actor's face, hands, important object or product, and environment in one coherent depth structure. Keep foreground occlusion intentional and preserve a clean direction of travel.",
    "LIGHT: Use motivated cinematic light from visible or plausible sources. Natural skin, tactile materials, controlled contrast, and no bright studio-light contamination unless the scene explicitly requires a studio.",
    `CONTINUITY: ${input.continuityNote || "Preserve identity, wardrobe, props, product, screen direction, background geography, palette, and time of day across adjacent shots."}`,
    "REALISM: Photoreal live-action captured through a physical camera unless the concept explicitly requests animation, manga, illustration, or another stylized medium.",
    ...(risks.length ? [`DIRECTOR CHECK: ${risks.map((risk) => risk.message).join(" ")}`] : []),
    `EXCLUSIONS: ${SHOT_KNOWLEDGE_BASE.negative.join(" ")}`,
  ].join("\n");
}

export function buildShotVideoPrompt(input: ShotPromptInput): string {
  const camera = cameraPlanForShot(input);
  const risks = auditShotScene(input.scene);
  return [
    `Animate scene ${input.sceneIndex + 1} of ${input.sceneCount} for "${input.productionTitle}" as one continuous five-second silent source clip whose usable action lands by four seconds.`,
    `STORY PROMISE: ${input.productionLogline || input.scene.objective || "One visible action creates one visible change."}`,
    "SOURCE FRAME: The supplied image is the exact first frame and complete art direction. Do not redesign, recompose, or invent a second angle.",
    `SCENE BEAT: ${input.scene.setting || "The established location"}; ${input.scene.objective || "one visible situation change"}.`,
    `0.0-0.8s — ESTABLISH: Hold long enough to read the actor, location, important object or product, and the starting body position.`,
    `0.8-3.2s — PERFORM: ${input.scene.action || `${input.actorName} completes one concise, physically plausible action.`}`,
    `3.2-4.0s — LAND: Finish the action, settle body and camera motion, and hold a clean final frame that expresses ${input.scene.objective || "the changed situation"}.`,
    `CAMERA PATH — ${camera.movementName}: ${camera.movementPrompt}`,
    `CAMERA LOCK: Preserve ${camera.angle}, ${camera.lens}, the source-image axis, horizon, lens character, subject scale, and established screen direction. No second move and no cut.`,
    "EDIT HANDLE: After the action lands at four seconds, hold the same pose and composition through five seconds with only natural breath and environmental inertia. The master edit uses the first four seconds.",
    `IDENTITY ANCHOR: Keep ${input.actorName}'s exact face, apparent age, hair, body proportions, skin detail, wardrobe, and distinguishing asymmetry from the supplied image.`,
    ...(input.hasProductReference
      ? [`PRODUCT ANCHOR: Keep the visible ${input.productName || "product"} continuously present, correctly shaped, correctly labeled, stable in scale, and physically connected to the stated surface or hand.`]
      : ["STORY ANCHOR: Preserve only the people, objects, and environmental evidence visible in this scene's supplied first frame. Do not invent an advertising setup or borrow objects from another scene."]),
    "PHYSICS: Natural blink, breath, grounded weight, cloth inertia, plausible hand contact, and restrained environmental motion. Every moving object must have an explicit owner, support, or contact point.",
    `CONTINUITY: ${input.continuityNote || "Do not reverse travel direction, swap positions, rebuild the background, add people, or change object count."}`,
    ...(risks.length ? [`SIMPLIFY BEFORE RENDER: ${risks.map((risk) => risk.message).join(" ")}`] : []),
    `NEGATIVE: ${SHOT_KNOWLEDGE_BASE.negative.join(" ")}`,
    "AUDIO: Silent visual plate only. No lip-sync, speech, effects, ambience, or music; audio is generated and mixed separately. --duration 5 --camerafixed false",
  ].join("\n");
}
