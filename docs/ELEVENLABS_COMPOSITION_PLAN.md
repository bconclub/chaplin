# ElevenLabs `composition_plan` — verified contract

Recorded by Claude Opus 5 after a live 422 blocked theme generation at 8%:

```
ElevenLabs returned 422: {"detail":{"type":"unprocessable_entity",
"message":"Invalid type of `composition_plan` used for model music_v2",
"param":"composition_plan"}}
```

Verified against https://elevenlabs.io/docs/api-reference/music/compose.
This file is documentation only — it deliberately changes no code, because
`src/lib/theme-composition-plan.ts` is being actively edited by another engine.

## Two contract violations in the current implementation

### 1. `composition_plan` is a **music_v1** feature

> "The `composition_plan` works with **music_v1** model only. Using this field
> with any other model will result in an error."

`buildElevenMusicRequest` currently does the opposite:

```ts
if (input.modelId !== "music_v2") {
  throw new Error("Chunk-based composition plans require the music_v2 model.");
}
```

The guard requires exactly the model the provider rejects, so every
composition-plan request fails. Should be `music_v1`.

### 2. The plan shape is `sections`, not `chunks`

The documented `MusicPrompt` object:

| Field | Type | Notes |
|---|---|---|
| `positive_global_styles` | `string[]` | styles present across the whole song |
| `negative_global_styles` | `string[]` | styles to avoid across the whole song |
| `sections` | `SongSection[]` | the musical sections |

Each `SongSection`:

| Field | Type | Notes |
|---|---|---|
| `section_name` | `string` | 1–100 chars |
| `positive_local_styles` | `string[]` | desirable directions for this section |
| `negative_local_styles` | `string[]` | directions to avoid in this section |
| `duration_ms` | `int` | between 3000 and 120000 |
| `lines` | `string[]` | lyrics; max 30 lines, 200 chars each. Empty for instrumentals — but the field is required |

The current implementation sends `{ chunks: [{ text: "[hook]",
positive_styles, negative_styles, context_adherence }] }`. None of `chunks`,
`text`, `positive_styles`, or `context_adherence` are fields in the documented
contract.

## Why the unit tests did not catch it

`theme-composition-plan.test.ts` validates the plan against the project's own
Zod schema. Both the schema and the tests encode the same incorrect shape, so
they agree with each other and never touch ElevenLabs' actual contract. A
schema asserted only against itself cannot detect a provider mismatch — the
first real signal was a paid 422 in production.

## The fix, in outline

1. `modelId !== "music_v1"` in the composition-plan guard.
2. Rename the schema to `{positive_global_styles, negative_global_styles,
   sections[]}` with the section fields above.
3. `buildThemePlan` already computes `positiveGlobal` / `negativeGlobal` and
   folds them into every chunk — a workaround for the assumption recorded in
   the code comment "Music v2 has no global-style fields". Lift them to the
   plan's top-level global fields and let each section carry only its local
   styles.
4. Update the four tests to the real field names, and assert
   `"sections" in plan` rather than `"chunks" in plan`.

An eventual guard worth adding: assert the outgoing request body against the
provider contract, not only against our own schema.
