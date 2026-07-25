import "server-only";

import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import {
  buildSignatureSfxFilterGraph,
  SignatureSfxTimelineSchema,
  type SignatureSfxTimelineItem,
} from "@/lib/signature-sfx";
import {
  getCharacterSfxAssetsById,
  saveMediaAsset,
  selectCharacterSfxAsset,
} from "@/lib/server/supabase-admin";
import { ffmpegExecutable } from "@/lib/server/ffmpeg-runtime";

const execute = promisify(execFile);

async function downloadChaplinAsset(url: string, destination: string) {
  const parsed = new URL(url);
  const storageHost = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname : "";
  if (parsed.protocol !== "https:" || parsed.hostname !== storageHost) {
    throw new Error("Signature SFX media must come from Chaplin's configured Supabase storage.");
  }
  const response = await fetch(parsed);
  if (!response.ok) throw new Error(`Download signature SFX event: ${response.status}.`);
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
}

/**
 * Mixes independently generated event assets on a five-second timeline.
 * Source assets remain untouched; the returned asset is a new featured stem.
 */
export async function assembleSignatureSfx(input: {
  characterId: string;
  timeline: SignatureSfxTimelineItem[];
}) {
  const timeline = SignatureSfxTimelineSchema.parse(input.timeline);
  const ffmpeg = ffmpegExecutable();
  const assets = await getCharacterSfxAssetsById({
    characterId: input.characterId,
    assetIds: timeline.map((item) => item.assetId),
  });
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  let workDirectory = "";
  try {
    workDirectory = await mkdtemp(path.join(tmpdir(), "chaplin-signature-sfx-"));
    const sourcePaths = timeline.map((_, index) => path.join(workDirectory, `event-${index + 1}.mp3`));
    const outputPath = path.join(workDirectory, "signature-sfx.mp3");
    await Promise.all(timeline.map((item, index) => {
      const asset = byId.get(item.assetId);
      if (!asset) throw new Error(`Signature SFX event ${item.assetId} was not found.`);
      return downloadChaplinAsset(asset.url, sourcePaths[index]);
    }));

    await execute(ffmpeg, [
      "-y",
      "-f", "lavfi",
      "-t", "5",
      "-i", "anullsrc=r=44100:cl=stereo",
      ...sourcePaths.flatMap((sourcePath) => ["-i", sourcePath]),
      "-filter_complex",
      buildSignatureSfxFilterGraph(timeline),
      "-map", "[aout]",
      "-c:a", "libmp3lame",
      "-b:a", "192k",
      "-t", "5",
      outputPath,
    ], { maxBuffer: 10 * 1024 * 1024, windowsHide: true });

    const output = await readFile(outputPath);
    const bytes = output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;
    const asset = await saveMediaAsset({
      characterId: input.characterId,
      kind: "sfx",
      provider: "ffmpeg",
      bytes,
      contentType: "audio/mpeg",
      durationSeconds: 5,
      metadata: {
        signatureSfxRole: "assembled",
        timeline,
        sourceAssetIds: timeline.map((item) => item.assetId),
      },
    });
    await selectCharacterSfxAsset({ characterId: input.characterId, assetId: asset.id });
    return { ...asset, durationSeconds: 5 as const, timeline };
  } finally {
    if (workDirectory) {
      await rm(workDirectory, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
