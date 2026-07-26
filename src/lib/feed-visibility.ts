type FeedGenerationVisibility = {
  assetKind?: string | null;
  jobMetadata?: unknown;
  mediaKind?: string | null;
  sourceAssetId?: string | null;
  videoType?: string | null;
};

function normalized(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase().replace(/[\s-]+/g, "_") : "";
}

export function isPunchGeneration(videoType?: string | null, metadata?: unknown) {
  if (["punch", "character_punch"].includes(normalized(videoType))) return true;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  const record = metadata as Record<string, unknown>;
  return [
    record.video_type,
    record.videoType,
    record.format,
    record.production_format,
    record.productionFormat,
  ].some((value) => ["punch", "character_punch"].includes(normalized(value)));
}

/**
 * The public feed is a finished-work surface, not a mirror of every provider
 * event. Admin generation logs retain every asset regardless of this policy.
 */
export function isGenerationVisibleInFeed(input: FeedGenerationVisibility) {
  if (!input.sourceAssetId) return normalized(input.mediaKind) !== "audio";

  const kind = normalized(input.assetKind);
  if (kind === "theme") return true;
  if (kind === "dialogue") return isPunchGeneration(input.videoType, input.jobMetadata);
  if (["audio", "sfx", "voice", "voice_design", "voice_lock"].includes(kind)) return false;

  // Every other generated media kind currently maps to a still/image or video.
  return normalized(input.mediaKind) !== "audio";
}
