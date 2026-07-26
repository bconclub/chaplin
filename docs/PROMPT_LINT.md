# Prompt handoff lint

Chaplin composes each provider prompt from named slots exactly once. Older
characters may contain fully rendered provider prompts in `voiceDesc`,
`sfxDesc`, or `themeDesc`; `unwrapLegacyDirection` extracts creator intent
before a fresh render so those templates are never nested.

Before a paid provider job starts, the complete character handoff is linted
locally with deterministic rules. The result is stored in
`generation_jobs.metadata.prompt_lint`. A failure for the requested artifact
blocks the provider call. Warnings remain reviewable and do not charge a
provider.

Rules:

- **L1** duplicated 21-word spans and unresolved default/template markers.
- **L2** canonical medium versus image-prompt medium and negative-prompt
  coherence.
- **L3** recognition-lock visibility (`always`, expression, or framing).
- **L4** wardrobe is a closed garment set; invented garments fail.
- **L5** story/narrative language cannot enter voice, SFX, or music.
- **L6** signature SFX is one atomic physical event, never a sequence.
- **L7** canon and voice-presentation mismatch is a warning that requires a
  persisted Super Admin confirmation before voice lock.

The Scene Handoff Map shows the lint duration, blocking summary, and issues on
the exact affected prompt card. The linter is Zod-validated, synchronous, and
uses no LLM or provider request.

