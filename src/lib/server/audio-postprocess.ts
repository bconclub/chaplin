import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import {
  ffmpegExecutable,
  isMissingFfmpegError,
} from "@/lib/server/ffmpeg-runtime";

const execute = promisify(execFile);
const THEME_FADE_SECONDS = 0.15;

export type DeliveredAudio = {
  bytes: ArrayBuffer;
  originalDurationSeconds: number;
  deliveredDurationSeconds: number;
  trimmed: boolean;
  fadeOutMilliseconds: number;
  postprocessStatus: "measured" | "trimmed" | "skipped";
  postprocessMessage: string | null;
};

function asArrayBuffer(buffer: Buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

function reportedDuration(value: number) {
  return Math.round(value * 1000) / 1000;
}

function durationFromFfmpegOutput(output: string) {
  const match = output.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const duration = hours * 3600 + minutes * 60 + seconds;
  return Number.isFinite(duration) && duration > 0 ? duration : null;
}

async function probeDuration(sourcePath: string, ffmpeg: string) {
  const configuredFfprobe = process.env.CHAPLIN_FFPROBE_PATH?.trim();
  if (configuredFfprobe) {
    const probe = await execute(configuredFfprobe, [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      sourcePath,
    ], { maxBuffer: 1024 * 1024, windowsHide: true });
    return Number(String(probe.stdout).trim());
  }

  try {
    await execute(ffmpeg, ["-hide_banner", "-i", sourcePath], {
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    });
  } catch (error) {
    if (isMissingFfmpegError(error)) throw error;
    const stderr = String((error as { stderr?: unknown }).stderr ?? "");
    const duration = durationFromFfmpegOutput(stderr);
    if (duration) return duration;
    throw error;
  }

  throw new Error("FFmpeg could not read the generated theme duration.");
}

/**
 * ElevenLabs normally respects music_length_ms. This enforces the delivery
 * boundary only when the provider overshoots it by more than one second.
 */
export async function enforceThemeDuration(
  bytes: ArrayBuffer,
  targetDurationSeconds: number,
): Promise<DeliveredAudio> {
  const workDirectory = await mkdtemp(path.join(tmpdir(), "chaplin-theme-"));
  const sourcePath = path.join(workDirectory, "provider-theme.mp3");
  const outputPath = path.join(workDirectory, "delivered-theme.mp3");
  const ffmpeg = ffmpegExecutable();

  try {
    await writeFile(sourcePath, Buffer.from(bytes));
    let originalDurationSeconds: number;
    try {
      originalDurationSeconds = await probeDuration(sourcePath, ffmpeg);
    } catch (error) {
      if (!isMissingFfmpegError(error)) throw error;
      return {
        bytes,
        originalDurationSeconds: targetDurationSeconds,
        deliveredDurationSeconds: targetDurationSeconds,
        trimmed: false,
        fadeOutMilliseconds: 0,
        postprocessStatus: "skipped",
        postprocessMessage: "FFmpeg was unavailable; accepted the provider-requested duration.",
      };
    }
    if (!Number.isFinite(originalDurationSeconds) || originalDurationSeconds <= 0) {
      throw new Error("FFmpeg could not read the generated theme duration.");
    }

    if (originalDurationSeconds <= targetDurationSeconds + 1) {
      return {
        bytes,
        originalDurationSeconds: reportedDuration(originalDurationSeconds),
        deliveredDurationSeconds: reportedDuration(originalDurationSeconds),
        trimmed: false,
        fadeOutMilliseconds: 0,
        postprocessStatus: "measured",
        postprocessMessage: null,
      };
    }

    const fadeStart = Math.max(0, targetDurationSeconds - THEME_FADE_SECONDS);
    await execute(ffmpeg, [
      "-y",
      "-i", sourcePath,
      "-vn",
      "-af", `atrim=0:${targetDurationSeconds},afade=t=out:st=${fadeStart}:d=${THEME_FADE_SECONDS}`,
      "-codec:a", "libmp3lame",
      "-b:a", "128k",
      outputPath,
    ], { maxBuffer: 10 * 1024 * 1024, windowsHide: true });
    const delivered = await readFile(outputPath);
    return {
      bytes: asArrayBuffer(delivered),
      originalDurationSeconds: reportedDuration(originalDurationSeconds),
      deliveredDurationSeconds: targetDurationSeconds,
      trimmed: true,
      fadeOutMilliseconds: THEME_FADE_SECONDS * 1000,
      postprocessStatus: "trimmed",
      postprocessMessage: null,
    };
  } finally {
    await rm(workDirectory, { recursive: true, force: true }).catch(() => undefined);
  }
}
