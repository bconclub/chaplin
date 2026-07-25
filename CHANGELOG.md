# Chaplin Changelog

This changelog records user-facing product changes, production-pipeline changes,
provider integrations, and the validation boundary for each major Chaplin update.

## 2026-07-25 - Character Identity OS and node workspace

### Character system

- Added a versioned `CharacterSystemProfile` to every production bible.
- Added eight canonical reference-sheet targets: front, left/right three-quarter,
  left/right profile, back, full body, and under-pressure expression.
- Added younger, canonical, and older age states while preserving four recognition
  locks across every generated variation.
- Added interaction rules that keep a character in first person, preserve the
  dramatic contradiction, maintain locked voice continuity, and prevent biography
  or system-prompt recitation.
- Added a memory policy with immutable canon, allowed memory types, forbidden
  writes, and separate recent/salient retrieval budgets.
- Added provider-ready character-sheet and interaction prompt composers.
- Added `docs/CHARACTER_SYSTEM.md` as the implementation and data-contract reference.

### Node-based character workspace

- Added `/characters/[id]/system`, a dedicated visual operating system for each
  character.
- Added draggable, persistent desktop nodes for canonical identity, direction
  bible, reference-sheet generation, sheet outputs, voice and sound, memory and
  interaction, scene performance, and reusable media.
- Added a mobile-safe connected stack so the workspace stays readable without a
  giant horizontal canvas.
- Added live angle and age selectors that regenerate the provider-ready reference
  prompt from the character's existing canon.
- Added links between the character profile, node workspace, media library, and
  existing production studio rather than creating a second generation pipeline.
- Added branded canvas and prompt scrollbars plus locally persisted node positions.

### Image-provider controls

- Expanded the Super Admin image model list for OpenRouter-routed Google, OpenAI,
  and Seedream models.
- Kept OpenRouter opt-in: adding `OPENROUTER_API_KEY` makes the provider available,
  while BytePlus remains the default until an administrator changes the pipeline.
- Preserved canonical image references in image-generation requests and kept
  provider usage/cost logging in the existing generation ledger.

### Actor discovery and mobile layout

- Fixed mobile actor-gallery packing so the selected four-column preview no longer
  leaves broken empty cells or pushes the interface outside the viewport.
- Preserved the full-height actor universe, floating Create control, and bottom
  navigation while keeping expanded character previews in place.

### Validation

- Passed the Next.js production build, TypeScript, targeted ESLint, `git diff
  --check`, and HTTP checks for the character profile and character-system routes.
- Provider calls still require populated environment keys and real provider quota;
  build success does not claim that paid generation was executed.
- Added tracked, sanitized web and mobile environment templates while keeping
  `.env.local` and all real credentials ignored.

## 2026-07-24 - Cinematic prompting, creation flow, and native production

### Shot-director knowledge base

- Added a structured library of camera movements with use cases, motion language,
  continuity rules, and anti-patterns.
- Added shot-direction logic that chooses camera motion from the dramatic beat
  instead of appending generic camera language.
- Added image-to-video guardrails: the supplied frame is the visual source of
  truth; prompts describe only visible motion, one camera move, secondary motion,
  and a short failure-focused negative list.
- Added reference-aware character generation so the canonical image remains the
  identity seed for later angles, scenes, and motion.
- Added concise image prompting organized around identity locks, composition,
  lens, camera height, motivated light, wardrobe, material response, and medium.
- Added explicit medium control: photoreal by default, with manga, animation, or
  stylized rendering only when the character canon requests it.
- Added `docs/shot-director-knowledge-base.md`.

### Creation and production UX

- Simplified duplicate Magic controls into a single assisted concept entry point.
- Added a visible writing timeline so users can see when concept, cast, script, and
  production-plan work is active.
- Added scene thumbnails and per-shot preview structure for multi-scene productions.
- Standardized short shots around four-to-five-second generation units that can be
  reviewed and assembled into longer outputs.
- Added clear idle, running, blocked, review, failed, and completed states to the
  production canvas.
- Added direct recovery actions for regenerate, review outputs, exit production,
  and return to the actor profile.
- Kept voice, effects, theme, still, video, approval, and assembly as distinct
  production stages.

### Native creator beta

- Added the isolated Expo application under `mobile/` without replacing the Next.js
  web product.
- Added creator authentication, actor building, editable Spark writing, five-second
  Spark production, library, studio, settings, and native draft storage.
- Added `/api/v1/mobile/*` endpoints for sessions, characters, drafts, prompt
  generation, reference upload, media generation, and library retrieval.
- Added bearer-authenticated native API access and support for an absolute
  `EXPO_PUBLIC_API_URL`.
- Added EAS configuration and native verification scripts.

## 2026-07-23 - Truthful production, playable outputs, and approval flow

### Media output contracts

- Defined ten first-class outputs: identity still, gallery still, poster, Spark,
  Punch, shot package, episode, brand spot, trailer/cutdown, and delivery package.
- Added provider-neutral pipeline runs and ordered steps with idempotency, retries,
  review gates, manifests, generation-job lineage, and explicit terminal states.
- Added versioned episode-shot takes; rejected generations remain traceable and only
  an approved take with a final muxed asset is promoted.
- Added `/api/pipeline`, `/api/pipeline/[id]`, `/api/pipeline/assemble`, and
  `/api/pipeline/mix`.
- Added the `/studio/pipelines` catalog and production boards for Spark, Punch,
  Episode, and Brand Spot workflows.

### Real output and preview behavior

- Connected pipeline success to a persisted media asset with a playable URL and
  asset ID.
- Added a live production canvas showing the latest real frame/video instead of a
  checklist pretending to be output.
- Added explicit "nothing generated yet" and "waiting for first frame" states.
- Added clear human-approval cards and actions at identity/composition and final-shot
  gates.
- Added feed links back to the production or media output so published status is
  not a dead end.
- Added FFmpeg-backed deterministic audio/video assembly for completed Punch output.

### Scene and ad reliability

- Fixed Magic Scene parsing so valid scenes are produced from story concepts even
  when the model response differs from the preferred schema.
- Added local structured fallback scenes when the writing provider cannot return a
  playable beat.
- Made the product reference image the first required input for product ads.
- Carried product identity into script, shot, reference-frame, and video prompts.
- Added scene objective, visible action, dialogue, duration, preview image, camera
  movement, and reference-asset fields to the story model.
- Added meaningful regeneration with higher creative variance while preserving the
  actor's immutable identity locks.

### Character production

- Rebuilt actor production as a staged workflow: voice, dialogue, short SFX takes,
  theme, still, motion, review, and profile selection.
- Fixed ElevenLabs minimum/maximum text-length failures with stage-specific prompt
  normalization.
- Kept the locked voice ID attached to dialogue generation so preview voices do not
  silently replace the selected character voice.
- Added media selection for profile voice, theme, effects, cover, and featured video.
- Added generated video availability above license terms on actor profiles.

### Admin and observability

- Added protected Super Admin login and server-side role checks.
- Added complete generation logs with provider, model, prompt/input, output,
  provider credits, runtime, estimated method, USD, INR, and Chaplin token views.
- Added editable pipeline controls for writing, voice, SFX, music, image, video, and
  pricing assumptions.
- Added generation events to the creator feed across accounts while keeping
  incomplete/private productions out of public Watch surfaces.

## 2026-07-23 - Role-aware product and social platform

- Replaced generic creation choices with exact production formats: Spark (5 seconds,
  1 shot), Punch (15 seconds, 3 shots), Episode (60 seconds, 12 shots), and Brand
  Spot (30 or 60 seconds, 6 or 12 shots).
- Split Create by Creator, Brand, and Super Admin with matching quick actions and
  Concierge intents.
- Added creator/brand email authentication, private drafts, continue-from-draft,
  account-aware creation, and Super Admin access.
- Added the creator feed with posts, images/video, replies, likes, reposts, shares,
  and cross-account generation activity.
- Added series and episode data, pages, and creation paths.
- Rebuilt Watch as a browse surface for stories, Sparks, ads/reels, and series.
- Rebuilt the bottom navigation with persistent Feed, Actors, Create, Watch, and
  Studio destinations.
- Added a full-height actor gallery with expanding playable tiles, rotating format
  copy, and an in-place Create entry point.

## 2026-07-22 - Voice-first Concierge and actor-builder intelligence

### Concierge

- Added the ElevenLabs Conversational AI Concierge with signed server-side session
  URLs and typed-intent fallback.
- Added live listening, speaking, thinking, and handoff states so the orb does not
  look idle while work is happening.
- Added character/video navigation tools and mission telemetry for connection,
  recognition, intent, and builder-open timings.
- Added Claude structured intent for one-sentence actor, video, ad, reel, and series
  creation.
- Added graceful OS-voice fallback and preferred an appropriate Indian narrator
  voice when the live ElevenLabs agent is unavailable.

### Actor builder

- Added multi-select archetype mixes with one leading archetype and supporting
  contradictions.
- Added a required canon brief and blocked Magic Character generation until the
  brief is meaningful.
- Increased structured-generation token budgets and guarded against truncated JSON.
- Disabled adaptive thinking for structured field-writing routes to reduce latency
  variance.
- Added elapsed-time progress feedback for full character-bible generation.
- Added Claude-powered Quick Write and Magic suggestions throughout character and
  scene fields.

## 2026-07-21 - Persistent actor media and first generation pipeline

- Added persistent Supabase character, generation-job, asset, voice, feed, and
  ledger records.
- Added ElevenLabs voice candidates, locked character voice reuse, dialogue, SFX,
  and theme generation.
- Added Seedream image generation and Seedance five-second image-to-video generation.
- Added canonical reference-image reuse for later character scenes.
- Added actor profile galleries, featured images/videos, sound controls, B-roll,
  resume, licensing, earnings, and maker management.
- Added Maker, Caster, Brand, and Super Admin product views.
- Added the initial role-aware homepage, actor shelf, story creation, and casting
  flows.
