# Character Card v2

Character Card v2 is the structured, validated identity source for a Chaplin
actor. It lives in `characters.card_v2` with `card_version = 2`. The older
`production_bible` remains available for actors that have not yet migrated.

## Routing contract

| Card field | Consumers | Rule |
| --- | --- | --- |
| `identity_locks.identity_block` | image, video | Inserted verbatim; never summarized or regenerated. |
| face anchors, recognition locks, age invariants | image, video | Geometry continuity only. |
| `negative_prompt` | image, video | Provider negative field when supported; otherwise `AVOID`. |
| exactly one `wardrobe_states` entry | image | A scene chooses one state; state details are never concatenated. |
| active `age_states` delta | image, video, voice, dialogue | Aging activates a state without replacing age-invariant locks. |
| `voice_slots` | voice | Rendered as labeled ElevenLabs design fields only. |
| `persona_card` and lived memory | dialogue | Used with the scene contract and few-shot pairs. |
| `dramatic_engine`, `story_grammar` | writing | Explicitly excluded from image, video, and voice prompts. |

## Prompt builders

- `buildImagePrompt(card, scene)` uses the identity block, one wardrobe state,
  active age delta, visual beat, camera/light, and negative prompt.
- `buildVideoPrompt(card, scene)` uses visual geometry continuity plus motion,
  camera, and timing. It contains no audio or biography direction.
- `buildVoiceDesignPrompt(card)` is a labeled ElevenLabs field list.
- `buildDialogueSystemPrompt(card, contract, memories)` emits `[CHARACTER CARD]`,
  `[SCENE CONTRACT]`, then few-shot examples.

`assertPromptConsistency` protects image and video generation. It throws in
development when the canonical identity block is absent, both wardrobe states
appear, or writing-only material leaks into a media prompt. In production the
warning is retained in `generation_jobs.metadata.characterCardConsistencyWarnings`.

## Migration

1. Apply `202607250002_character_card_v2.sql`.
2. Run `npm run migrate:agni-maya` with the Supabase admin environment values.
3. Verify `card_version = 2`; the v2 builders are selected automatically.

New cards must pass `CharacterCardV2Schema` on API read/write. Existing actors
without a valid card continue through the v1 prose production-bible route.
