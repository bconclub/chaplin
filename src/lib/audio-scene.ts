import { seedanceSupportsAudioReference } from "@/lib/seedance-audio";

/**
 * The AUDIO SCENE grammar for video generation.
 *
 * Seedance 2.0 is multimodal and can take the actor's locked ElevenLabs line as
 * an audio reference, driving lip-sync from the real recording. Models that
 * cannot take that reference must never be asked to voice the actor at all -
 * they would invent a voice, and voice identity is law. This module owns that
 * decision so no call site has to remember it.
 */

/** How a shot's audio is produced. */
export type AudioMode =
  /** Path A: locked voice attached as an audio reference; model lip-syncs to it. */
  | "native-ref"
  /** Path B: model generates ambience and effects only; no speech of any kind. */
  | "native-ambient"
  /** Legacy silent plate. Everything is mixed afterwards. */
  | "silent";

export type SfxMoment = {
  /** What is visibly making the sound. */
  description: string;
  /** Seconds into the shot, aligned to the visible action. */
  atSeconds: number;
};

export type SceneAudioPlan = {
  dialogueLine?: string;
  /** One bed, described physically. */
  ambience: string;
  sfxMoments: SfxMoment[];
};

export type AudioSceneInput = {
  model: string;
  generateAudio: boolean;
  shotDurationSeconds: number;
  plan: SceneAudioPlan;
  speakerName?: string;
  /** Locked ElevenLabs render for this line. Absent means Path A is impossible. */
  referenceAudioUrl?: string;
  /** Delivery register from the character card - at-rest or under pressure. */
  delivery?: string;
  /** Measured duration of the locked line, when the TTS render is already in hand. */
  lineDurationSeconds?: number;
};

export type AudioSceneResolution = {
  mode: AudioMode;
  /** True when the line could not ride along and must be mixed in afterwards. */
  postMix: boolean;
  /** Path B dialogue shots must not show a talking face. */
  requiresOffFaceFraming: boolean;
  block: string;
};

/** Head and tail padding the spoken line must sit inside. */
export const DIALOGUE_EDGE_PADDING_SECONDS = 0.5;

/** Two is the cap: more timed effects than that stop being legible in four seconds. */
export const MAX_SFX_MOMENTS = 2;

const NEGATIVE_COMMON = "no music, no invented voices, no narration, no crowd walla with intelligible words";
const NEGATIVE_NO_SPEECH = "no speech, no dialogue, no vocal sounds";

/**
 * Rough spoken duration of a line.
 *
 * Used only to reject a line that cannot fit before spending on a render; the
 * measured duration of the real TTS file supersedes it whenever it is known.
 * 165 words per minute is an unhurried delivery - deliberately conservative, so
 * the estimate errs toward rejecting a line that would have been clipped.
 */
export function estimateSpeechSeconds(line: string) {
  const words = line.trim().split(/\s+/).filter(Boolean).length;
  if (!words) return 0;
  return (words / 165) * 60;
}

/** The window a spoken line may occupy inside a shot. */
export function dialogueWindow(shotDurationSeconds: number) {
  const start = DIALOGUE_EDGE_PADDING_SECONDS;
  const end = shotDurationSeconds - DIALOGUE_EDGE_PADDING_SECONDS;
  return { start, end, available: Math.max(0, end - start) };
}

export type DialogueFitResult =
  | { fits: true; seconds: number; window: ReturnType<typeof dialogueWindow> }
  | { fits: false; seconds: number; window: ReturnType<typeof dialogueWindow>; error: string };

/**
 * Whether the locked line fits the shot with head and tail padding intact.
 *
 * A line that overruns is not trimmed: clipping the actor's performance is a
 * worse failure than refusing the shot, because the delivered cut would carry a
 * severed word in the actor's own locked voice.
 */
export function checkDialogueFit(input: {
  line: string;
  shotDurationSeconds: number;
  lineDurationSeconds?: number;
}): DialogueFitResult {
  const window = dialogueWindow(input.shotDurationSeconds);
  const seconds = input.lineDurationSeconds ?? estimateSpeechSeconds(input.line);
  if (seconds > window.available) {
    return {
      fits: false,
      seconds,
      window,
      error: `The line runs ${seconds.toFixed(2)}s but only ${window.available.toFixed(2)}s is available in a ${input.shotDurationSeconds}s shot once ${DIALOGUE_EDGE_PADDING_SECONDS}s head and tail are reserved. Shorten the line or lengthen the shot.`,
    };
  }
  return { fits: true, seconds, window };
}

/** Throws rather than submitting a shot whose line would be clipped. */
export function assertDialogueFits(input: {
  line: string;
  shotDurationSeconds: number;
  lineDurationSeconds?: number;
}) {
  const result = checkDialogueFit(input);
  if (!result.fits) throw new Error(result.error);
  return result;
}

function sfxLine(moments: SfxMoment[]) {
  const timed = moments
    .slice(0, MAX_SFX_MOMENTS)
    .map((moment) => `${moment.description.trim().replace(/[.\s]+$/, "")} at ${moment.atSeconds}s`);
  return timed.join("; ");
}

/**
 * Decides how a shot's audio is produced and renders the AUDIO SCENE block.
 *
 * Path A needs both a model that accepts an audio reference and a locked render
 * to attach. Missing either one drops to Path B, and a Path B shot that still
 * has a line is marked post-mix and framed off-face, so the model is never
 * asked to animate a mouth it has no recording for.
 */
export function resolveAudioScene(input: AudioSceneInput): AudioSceneResolution {
  const line = input.plan.dialogueLine?.trim() ?? "";
  const ambience = input.plan.ambience.trim();
  const sfx = sfxLine(input.plan.sfxMoments);

  if (!input.generateAudio) {
    return {
      mode: "silent",
      postMix: Boolean(line),
      requiresOffFaceFraming: false,
      block: "",
    };
  }

  const canAttachReference = seedanceSupportsAudioReference(input.model) && Boolean(input.referenceAudioUrl);
  const pathA = Boolean(line) && canAttachReference;

  const parts: string[] = ["[AUDIO SCENE]"];

  if (pathA) {
    const { window } = assertDialogueFits({
      line,
      shotDurationSeconds: input.shotDurationSeconds,
      lineDurationSeconds: input.lineDurationSeconds,
    });
    const speaker = input.speakerName?.trim() || "the actor";
    const delivery = input.delivery?.trim();
    parts.push(
      `[DIALOGUE] speaker=${speaker}; speaks at ${window.start}-${window.end}s.${delivery ? ` Delivery: ${delivery}.` : ""} Lip-sync to the provided audio reference, which is the actor's locked voice; do not re-voice, re-time, or re-word it.`,
    );
  } else if (line) {
    // Path B still has a line to deliver, but not here.
    parts.push(
      "[DIALOGUE] None in this shot. The speaking actor is framed off-face - over-shoulder, hands, profile, or on the listener - and any direct-address beat is held under 2s. The line is mixed in afterwards.",
    );
  }

  parts.push(`[AMBIENCE] ${ambience}`);
  if (sfx) parts.push(`[SFX MOMENTS] ${sfx}`);
  parts.push(`[AUDIO NEGATIVE] ${pathA ? NEGATIVE_COMMON : `${NEGATIVE_COMMON}, ${NEGATIVE_NO_SPEECH}`}`);

  return {
    mode: pathA ? "native-ref" : "native-ambient",
    postMix: Boolean(line) && !pathA,
    requiresOffFaceFraming: Boolean(line) && !pathA,
    block: parts.join("\n"),
  };
}
