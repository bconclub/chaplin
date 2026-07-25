import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);
const THEME_FADE_SECONDS = 0.15;

export type DeliveredAudio = {
  bytes: ArrayBuffer;
  originalDurationSeconds: number;
  deliveredDurationSeconds: number;
  trimmed: boolean;
  fadeOutMilliseconds: number;
};

function asArrayBuffer(buffer: Buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

function reportedDuration(value: number) {
  return Math.round(value * 1000) / 1000;
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
  const ffprobe = process.env.CHAPLIN_FFPROBE_PATH || "ffprobe";
  const ffmpeg = process.env.CHAPLIN_FFMPEG_PATH || "ffmpeg";

  try {
    await writeFile(sourcePath, Buffer.from(bytes));
    const probe = await execute(ffprobe, [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      sourcePath,
    ], { maxBuffer: 1024 * 1024, windowsHide: true });
    const originalDurationSeconds = Number(String(probe.stdout).trim());
    if (!Number.isFinite(originalDurationSeconds) || originalDurationSeconds <= 0) {
      throw new Error("FFprobe could not read the generated theme duration.");
    }

    if (originalDurationSeconds <= targetDurationSeconds + 1) {
      return {
        bytes,
        originalDurationSeconds: reportedDuration(originalDurationSeconds),
        deliveredDurationSeconds: reportedDuration(originalDurationSeconds),
        trimmed: false,
        fadeOutMilliseconds: 0,
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
    };
  } finally {
    await rm(workDirectory, { recursive: true, force: true }).catch(() => undefined);
  }
}
