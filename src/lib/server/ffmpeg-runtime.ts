import ffmpegStaticPath from "ffmpeg-static";

export function ffmpegExecutable() {
  return process.env.CHAPLIN_FFMPEG_PATH?.trim() || ffmpegStaticPath || "ffmpeg";
}

export function isMissingFfmpegError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; cause?: unknown };
  if (candidate.code === "ENOENT") return true;
  return Boolean(
    candidate.cause
    && typeof candidate.cause === "object"
    && (candidate.cause as { code?: unknown }).code === "ENOENT"
  );
}
