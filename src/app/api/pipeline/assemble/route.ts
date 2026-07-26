import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { attachMediaPipelineOutput, getMediaPipelineRun } from "@/lib/server/media-pipeline";
import { getCharacterProductionState, saveMediaAsset } from "@/lib/server/supabase-admin";
import { ffmpegExecutable, isMissingFfmpegError } from "@/lib/server/ffmpeg-runtime";

export const runtime = "nodejs";
export const maxDuration = 120;

const execute = promisify(execFile);

async function download(url: string, destination: string) {
  const parsed = new URL(url);
  const storageHost = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname : "";
  if (parsed.protocol !== "https:" || parsed.hostname !== storageHost) {
    throw new Error("Shot media must come from Chaplin's configured storage.");
  }
  const response = await fetch(parsed);
  if (!response.ok) throw new Error(`Download shot media: ${response.status}.`);
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
}

export async function POST(request: Request) {
  let workDirectory = "";
  try {
    const input = await request.json() as Record<string, unknown>;
    const runId = typeof input.runId === "string" ? input.runId : "";
    const characterId = typeof input.characterId === "string" ? input.characterId : "";
    const shotUrls = Array.isArray(input.shotUrls)
      ? input.shotUrls.filter((value): value is string => typeof value === "string" && Boolean(value))
      : [];
    const frameUrls = Array.isArray(input.frameUrls)
      ? input.frameUrls.filter((value): value is string => typeof value === "string" && Boolean(value))
      : [];
    const requestedDialogueUrl = typeof input.dialogueUrl === "string" ? input.dialogueUrl : "";
    const requestedThemeUrl = typeof input.themeUrl === "string" ? input.themeUrl : "";
    const sceneDurationSeconds = Math.min(5, Math.max(1, Number(input.sceneDurationSeconds) || 4));
    const finalDurationSeconds = Math.min(120, Math.max(1, Number(input.finalDurationSeconds) || shotUrls.length * sceneDurationSeconds));
    if (!runId || !characterId || shotUrls.length < 1 || shotUrls.length > 20) {
      throw new Error("A pipeline run, actor, and between one and twenty scene URLs are required.");
    }
    const run = await getMediaPipelineRun(runId);
    if (!run) throw new Error("Pipeline run was not found.");
    if (run.outputType !== "punch") throw new Error("This assembler currently expects a Punch production.");

    workDirectory = await mkdtemp(path.join(tmpdir(), "chaplin-punch-"));
    const shotPaths = shotUrls.map((_, index) => path.join(workDirectory, `scene-${index + 1}.mp4`));
    const outputPath = path.join(workDirectory, "punch-master.mp4");
    await Promise.all(shotUrls.map((url, index) => download(url, shotPaths[index])));

    /*
      The master used to be assembled with concat a=0 and only [vout] mapped, so
      every audio stream was discarded and the delivered file was silent — the
      actor's locked voice and their theme never reached the cut.

      Audio is now built over a generated silent bed rather than taken from the
      clips, so assembly succeeds whether or not a shot carries sound: the bed
      guarantees a stream of exactly the right length, and the performance stems
      are mixed on top of it. Dialogue sits at full level; the theme sits well
      under it and loops to cover the whole cut.
    */
    /*
      Stems are resolved here rather than demanded from the caller: the spoken
      line is already attached to the run's dialogue step, and the theme belongs
      to the actor. Existing callers therefore gain sound without any change,
      and an explicit URL in the request still wins.
    */
    const runDialogueUrl = run.steps.find((step) => step.key === "dialogue")?.output.url;
    const production = await getCharacterProductionState(characterId).catch(() => null);
    const dialogueUrl = requestedDialogueUrl
      || (typeof runDialogueUrl === "string" ? runDialogueUrl : "")
      || production?.latestDialogueUrl
      || "";
    const themeUrl = requestedThemeUrl || production?.latestThemeUrl || "";

    const dialoguePath = dialogueUrl ? path.join(workDirectory, "dialogue.mp3") : "";
    const themePath = themeUrl ? path.join(workDirectory, "theme.mp3") : "";
    await Promise.all([
      dialoguePath ? download(dialogueUrl, dialoguePath) : Promise.resolve(),
      themePath ? download(themeUrl, themePath) : Promise.resolve(),
    ]);

    const stemInputs: string[] = [];
    const stemLabels: string[] = [];
    let inputIndex = shotPaths.length;
    // The silent bed is always input N, immediately after the shots.
    const bedIndex = inputIndex;
    inputIndex += 1;
    const audioFilters = [`[${bedIndex}:a]atrim=0:${finalDurationSeconds},asetpts=PTS-STARTPTS[abed]`];
    stemLabels.push("[abed]");

    if (dialoguePath) {
      stemInputs.push("-i", dialoguePath);
      audioFilters.push(`[${inputIndex}:a]volume=1.0,apad,atrim=0:${finalDurationSeconds},asetpts=PTS-STARTPTS[adlg]`);
      stemLabels.push("[adlg]");
      inputIndex += 1;
    }
    if (themePath) {
      stemInputs.push("-i", themePath);
      audioFilters.push(`[${inputIndex}:a]volume=0.18,aloop=loop=-1:size=2e9,atrim=0:${finalDurationSeconds},asetpts=PTS-STARTPTS[athm]`);
      stemLabels.push("[athm]");
      inputIndex += 1;
    }
    audioFilters.push(`${stemLabels.join("")}amix=inputs=${stemLabels.length}:duration=first:dropout_transition=0,alimiter=limit=0.95[aout]`);

    await execute(ffmpegExecutable(), [
      "-y",
      ...shotPaths.flatMap((shotPath) => ["-i", shotPath]),
      "-f", "lavfi", "-t", String(finalDurationSeconds), "-i", "anullsrc=r=48000:cl=stereo",
      ...stemInputs,
      "-filter_complex",
      [
        ...shotPaths.map((_, index) => (
          `[${index}:v]trim=duration=${sceneDurationSeconds},scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black,fps=24,setsar=1,setpts=PTS-STARTPTS[v${index}]`
        )),
        `${shotPaths.map((_, index) => `[v${index}]`).join("")}concat=n=${shotPaths.length}:v=1:a=0[vout]`,
        ...audioFilters,
      ].join(";"),
      "-map", "[vout]",
      "-map", "[aout]",
      "-c:v", "libx264",
      "-preset", "medium",
      "-crf", "20",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "192k",
      "-ar", "48000",
      "-t", String(finalDurationSeconds),
      "-movflags", "+faststart",
      outputPath,
    ], { maxBuffer: 10 * 1024 * 1024, windowsHide: true });

    const output = await readFile(outputPath);
    const bytes = output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;
    const asset = await saveMediaAsset({
      characterId,
      kind: "video",
      provider: "ffmpeg",
      bytes,
      contentType: "video/mp4",
      durationSeconds: finalDurationSeconds,
      metadata: {
        pipelineRunId: run.id,
        outputType: "punch",
        sourceUrls: shotUrls,
        sourceFrameUrls: frameUrls,
        sceneDurationSeconds,
        finalDurationSeconds,
      },
    });
    const renderedOutput = {
      url: asset.url,
      durationSeconds: finalDurationSeconds,
      shotUrls,
      frameUrls,
      sceneDurationSeconds,
      renderedAt: new Date().toISOString(),
    };
    const updatedRun = await attachMediaPipelineOutput({
      runId,
      stepKeys: ["assembly", "mastering", "creative-review"],
      output: renderedOutput,
      outputAssetId: asset.id,
    });
    return Response.json({ url: asset.url, assetId: asset.id, run: updatedRun });
  } catch (error) {
    const message = isMissingFfmpegError(error)
      ? "Chaplin's video editor is not available in this deployment. The bundled FFmpeg binary was not packaged."
      : error instanceof Error ? error.message : "Could not assemble the Punch output.";
    return Response.json(
      { error: message },
      { status: 500 },
    );
  } finally {
    if (workDirectory) await rm(workDirectory, { recursive: true, force: true }).catch(() => undefined);
  }
}
