# Seedance 2.0 audio capability probe

Findings from the ModelArk client as it stands, ahead of audio-aware video
generation. Source of truth: the task-creation call in
`src/app/api/generate/route.ts` and `src/lib/seedance-audio.ts`.

## (a) Audio reference input — SUPPORTED

The request body's `content` array is multimodal and already accepts an audio
reference alongside the text prompt and the approved still:

```js
content: [
  { type: "text", text: prompt },
  { type: "image_url", image_url: { url } },          // approved first frame
  { type: "audio_url", audio_url: { url }, role: "reference_audio" },
]
```

It is gated on the model by `seedanceSupportsAudioReference()`, which matches
`/dreamina-seedance-2-0/i` only. **Path A is therefore viable** and no new
transport work is needed to attach a locked ElevenLabs line.

## (b) Native audio output toggle — SUPPORTED

`generate_audio` is a top-level boolean on the task request, read from the
pipeline config via `settingBoolean(videoConfig, "generateAudio", true)`. It is
already on by default, so shots are not silent plates unless the config says so.

`prepareSeedanceAudioPrompt()` already switches prompt grammar three ways:
reference audio + dialogue (lip-sync brief), `generateAudio` on (diegetic-only
brief), and off (silent plate preserved). The `kind: "silent"` path is intact.

## (c) Maximum audio reference length — UNKNOWN, UNGUARDED

**No length limit is declared or asserted anywhere in the client.** The
reference URL is passed straight through with no duration check, so an
over-length line would fail at the provider rather than at submit time. This
must be confirmed against BytePlus ModelArk documentation before Path A ships;
until then the duration assertion required by TASK 1 (TTS line must fit shot
duration minus 0.5s head/tail) has nothing to validate against on the upper
bound.

## Gap worth deciding on: the fallback model silently drops lip-sync

The video stage fails over across `[videoConfig.model, fallbackModel]`, where
`fallbackModel` defaults to `seedance-1-5-pro-251215`. That model does **not**
match `seedanceSupportsAudioReference()`, so when a Seedance 2.0 dialogue shot
fails over, the audio reference is dropped and the shot renders without
lip-sync — with no error and no flag on the job. Path A needs an explicit
decision here: either refuse the fallback for dialogue shots, or mark the
delivered shot post-mix so the FFmpeg path attaches the line instead.

## Conclusion

Path A is unblocked on transport (a and b are supported). Two things gate it:
confirming the reference-length ceiling in (c), and resolving the fallback
behaviour above so voice identity cannot silently drift.
