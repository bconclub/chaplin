import type { AdminAssetRow, AdminCharacterRow, AdminJobRow } from "@/lib/server/supabase-admin";
import MediaPlayer from "@/components/MediaPlayer";

const IMAGE_ASSET_KINDS = new Set(["avatar", "banner", "gallery", "image", "still"]);
const VIDEO_ASSET_KINDS = new Set(["video", "broll", "final", "motion-plate"]);

function assetMediaKind(asset: AdminAssetRow) {
  if (VIDEO_ASSET_KINDS.has(asset.kind) || /\.(mp4|mov|webm)(?:$|\?)/i.test(asset.url)) return "video";
  if (IMAGE_ASSET_KINDS.has(asset.kind) || /\.(png|jpe?g|webp|gif|avif)(?:$|\?)/i.test(asset.url)) return "image";
  return "audio";
}

function AdminGenerationMedia({
  asset,
  label,
}: {
  asset: AdminAssetRow;
  label: string;
}) {
  const kind = assetMediaKind(asset);

  return (
    <section className="mb-5 overflow-hidden rounded-md border border-line bg-black/20" data-admin-output-media={kind}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2.5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">Generated media</p>
          <p className="mt-0.5 text-xs capitalize text-grey">{asset.kind} · {asset.provider}</p>
        </div>
        <a href={asset.url} target="_blank" rel="noreferrer" className="rounded-full border border-line px-3 py-1.5 text-[10px] font-semibold text-grey hover:border-accent hover:text-accent">
          Open original ↗
        </a>
      </div>
      {kind === "image" ? (
        <a href={asset.url} target="_blank" rel="noreferrer" className="block bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element -- generated provider URLs are dynamic */}
          <img src={asset.url} alt={label} className="max-h-[34rem] min-h-48 w-full object-contain" loading="lazy" />
        </a>
      ) : (
        <div className="p-3 sm:p-4">
          <MediaPlayer src={asset.url} label={label} kind={kind} />
        </div>
      )}
    </section>
  );
}

function number(value: number | string | null | undefined) {
  return value == null ? 0 : Number(value);
}

function formatUsd(value: number | string | null | undefined) {
  return `$${number(value).toFixed(4)}`;
}

function formatInr(value: number | string | null | undefined) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(number(value));
}

function formatTimestamp(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "medium" }).format(new Date(value))
    : "—";
}

function jobRuntimeMs(job: AdminJobRow) {
  if (!job.started_at) return null;
  const end = job.completed_at ? new Date(job.completed_at).getTime() : Date.now();
  return Math.max(0, end - new Date(job.started_at).getTime());
}

function formatRuntime(milliseconds: number | null) {
  if (milliseconds == null) return "—";
  if (milliseconds < 60_000) return `${(milliseconds / 1000).toFixed(1)}s`;
  const minutes = Math.floor(milliseconds / 60_000);
  const seconds = Math.round((milliseconds % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

const TIMING_GROUPS = [
  { label: "Voice", kinds: ["voice-design", "voice-lock"] },
  { label: "Dialogue", kinds: ["dialogue"] },
  { label: "Sound design", kinds: ["sfx"] },
  { label: "Music", kinds: ["theme"] },
  { label: "Static images", kinds: ["gallery", "image", "avatar", "banner", "still"] },
  { label: "Video", kinds: ["video", "broll", "motion-plate", "final"] },
] as const;

export default function AdminGenerationLogList({
  jobs,
  assets,
  characters,
}: {
  jobs: AdminJobRow[];
  assets: AdminAssetRow[];
  characters: AdminCharacterRow[];
}) {
  if (jobs.length === 0) {
    return (
      <div className="border border-dashed border-line rounded-md px-4 py-12 text-center">
        <p className="text-sm">No generation events yet</p>
        <p className="text-xs text-grey mt-1">Voice, SFX, image, and video jobs will appear here automatically.</p>
      </div>
    );
  }

  const timingGroups = TIMING_GROUPS.map((group) => {
    const durations = jobs
      .filter((job) => group.kinds.some((kind) => kind === job.kind) && job.started_at && job.completed_at)
      .map(jobRuntimeMs)
      .filter((value): value is number => value != null);
    return {
      ...group,
      count: durations.length,
      average: durations.length
        ? durations.reduce((total, duration) => total + duration, 0) / durations.length
        : null,
      minimum: durations.length ? Math.min(...durations) : null,
      maximum: durations.length ? Math.max(...durations) : null,
    };
  });

  return (
    <div className="flex flex-col gap-3" data-admin-generation-logs>
      <section className="poster-card rounded-md p-4 sm:p-5" data-generation-timing-summary>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">End-to-end timing</p>
            <h2 className="reel-title mt-1 text-xl">How long each generation takes</h2>
          </div>
          <p className="text-[10px] text-grey">Server start to provider output or failure</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {timingGroups.map((group) => (
            <article key={group.label} className="rounded-sm border border-line bg-black/10 p-3">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-grey">{group.label}</p>
              <p className="mt-1 text-lg font-semibold text-ink">{formatRuntime(group.average)}</p>
              <p className="mt-1 text-[9px] text-grey">
                {group.count
                  ? `${group.count} runs · ${formatRuntime(group.minimum)}–${formatRuntime(group.maximum)}`
                  : "No completed runs"}
              </p>
            </article>
          ))}
        </div>
      </section>
      {jobs.map((job, index) => {
        const character = characters.find((item) => item.id === job.character_id);
        const asset = assets.find((item) => item.id === job.output_asset_id);
        const runtimeMs = jobRuntimeMs(job);
        return (
          <details key={job.id} open={index < 3} className="poster-card rounded-md group overflow-hidden">
            <summary className="list-none cursor-pointer p-4 sm:p-5 grid sm:grid-cols-[auto_1fr_auto] gap-3 items-start hover:bg-white/[0.025]">
              <span className={`w-2 h-2 mt-1.5 rounded-full ${job.status === "succeeded" ? "bg-emerald-500" : job.status === "failed" ? "bg-red-500" : "bg-amber-400"}`} />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <strong className="text-sm capitalize">{job.kind}</strong>
                  <span className="text-[10px] uppercase tracking-wide text-grey">{job.status}</span>
                  <span className="text-[10px] font-semibold text-accent">{formatRuntime(runtimeMs)}</span>
                  <span className="text-[11px] text-grey">{character?.name ?? job.character_id ?? "System"}</span>
                </span>
                <span className="block text-[11px] text-grey mt-1 break-words">{job.provider} · {job.model} · {formatTimestamp(job.created_at)}</span>
              </span>
              <span className="grid grid-cols-3 gap-3 text-right text-[11px] whitespace-nowrap">
                <span><b className="block text-ink">{job.normalized_tokens == null ? "—" : Math.round(number(job.normalized_tokens))}</b><span className="text-grey">tokens</span></span>
                <span><b className="block text-ink">{job.cost_usd == null ? "—" : formatUsd(job.cost_usd)}</b><span className="text-grey">USD</span></span>
                <span><b className="block text-ink">{job.cost_inr == null ? "—" : formatInr(job.cost_inr)}</b><span className="text-grey">INR</span></span>
              </span>
            </summary>
            <div className="border-t border-line p-4 sm:p-5 text-xs">
              {asset && (
                <AdminGenerationMedia
                  asset={asset}
                  label={`${character?.name ?? "Chaplin"} ${job.kind} output`}
                />
              )}
              {!asset && job.status === "succeeded" && (
                <div className="mb-5 rounded-md border border-dashed border-line px-4 py-5 text-grey">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em]">No playable media attached</p>
                  <p className="mt-1 text-xs">This job completed without a media asset, such as a voice lock or writing-only operation.</p>
                </div>
              )}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
                {[
                  ["Video type", job.video_type ?? "Character / legacy"],
                  ["Product", job.product_id ?? "—"],
                  ["Brief", job.video_brief_id ?? "—"],
                  ["Provider credits", job.provider_credits ?? "Not returned"],
                  ["Started", formatTimestamp(job.started_at)],
                  ["Ended", formatTimestamp(job.completed_at)],
                  ["Runtime", runtimeMs == null ? "—" : `${(runtimeMs / 1000).toFixed(2)}s`],
                  ["FX rate", job.usd_to_inr_rate == null ? "—" : `₹${number(job.usd_to_inr_rate).toFixed(4)} / $1`],
                  ["Cost method", job.cost_method ?? "Historical / unavailable"],
                ].map(([label, value]) => (
                  <div key={label} className="bg-white/[0.03] rounded-sm p-3 min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-grey">{label}</p>
                    <p className="mt-1 break-words">{String(value)}</p>
                  </div>
                ))}
              </div>
              <div className="grid lg:grid-cols-2 gap-5">
                <div className="space-y-3 min-w-0">
                  <div><p className="text-[10px] uppercase tracking-wide text-grey mb-1">Prompt / input</p><p className="whitespace-pre-wrap break-words">{job.prompt ?? "No prompt stored"}</p></div>
                  <div><p className="text-[10px] uppercase tracking-wide text-grey mb-1">Usage</p><pre className="text-[11px] whitespace-pre-wrap break-words bg-black/20 rounded-sm p-2 overflow-x-auto">{JSON.stringify(job.usage ?? {}, null, 2)}</pre></div>
                </div>
                <div className="space-y-3 min-w-0">
                  <div><p className="text-[10px] uppercase tracking-wide text-grey mb-1">Pricing explanation</p><p className="break-words">{job.pricing_note ?? "This historical job predates cost instrumentation."}</p></div>
                  <div><p className="text-[10px] uppercase tracking-wide text-grey mb-1">Trace</p><p className="break-all">Job {job.id}</p><p className="break-all text-grey">Request {job.provider_request_id ?? "not returned"}</p></div>
                  {Object.keys(job.metadata ?? {}).length > 0 && <div><p className="text-[10px] uppercase tracking-wide text-grey mb-1">Generation metadata</p><pre className="text-[11px] whitespace-pre-wrap break-words bg-black/20 rounded-sm p-2 overflow-x-auto">{JSON.stringify(job.metadata, null, 2)}</pre></div>}
                  {asset && <div><p className="text-[10px] uppercase tracking-wide text-grey mb-1">Output asset</p><a href={asset.url} target="_blank" rel="noreferrer" className="text-accent hover:underline break-all">Open CDN asset ↗</a></div>}
                  {job.error_message && <div className="bg-red-500/10 text-red-500 rounded-sm p-3 break-words"><p className="text-[10px] uppercase tracking-wide mb-1">Error</p>{job.error_message}</div>}
                </div>
              </div>
            </div>
          </details>
        );
      })}
    </div>
  );
}
