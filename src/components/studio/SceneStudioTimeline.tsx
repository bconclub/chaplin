"use client";

export type TimelineScene = {
  index: number;
  setting: string;
  objective?: string;
  action?: string;
  durationSeconds: number;
  lineCount: number;
  rendered: boolean;
};

/**
 * Which beat the story turns on.
 *
 * A Punch is hook, pressure, then one memorable choice, so the turn is the
 * penultimate beat. A two-beat piece turns on its last beat, and anything
 * longer than four turns near the middle. Derived from the beat count rather
 * than authored, so the marker cannot drift out of sync with the script.
 */
export function pivotIndexFor(beatCount: number) {
  if (beatCount <= 0) return -1;
  if (beatCount <= 2) return beatCount - 1;
  if (beatCount <= 4) return beatCount - 2;
  return Math.floor(beatCount / 2);
}

/**
 * Where each beat lands in screen time.
 *
 * The studio reported a runtime and a shot count but never said what happens
 * when: a creator could not see that scene three is the turn, or that the whole
 * story pivots eleven seconds in. This lays the beats on the actual clock so
 * the shape of the cut is readable before a frame is rendered.
 */
export default function SceneStudioTimeline({
  scenes,
  totalSeconds,
  activeIndex,
  onSelect,
}: {
  scenes: TimelineScene[];
  totalSeconds: number;
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  if (!scenes.length) return null;

  // Beats are laid on their real cumulative offsets rather than an even split,
  // so a scene that runs long reads as running long.
  const placed = scenes.reduce<Array<TimelineScene & { start: number; end: number }>>((acc, scene) => {
    const start = acc.length ? acc[acc.length - 1].end : 0;
    acc.push({ ...scene, start, end: start + scene.durationSeconds });
    return acc;
  }, []);
  const elapsed = placed.length ? placed[placed.length - 1].end : 0;
  const span = Math.max(elapsed, totalSeconds) || 1;

  const pivotIndex = pivotIndexFor(placed.length);

  return (
    <section className="rounded-xl border border-line/70 bg-black/20 p-4" data-scene-timeline>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-accent-secondary">Screen time</p>
        <p className="text-[10px] text-grey">
          {placed.length} {placed.length === 1 ? "beat" : "beats"} · {elapsed}s of {totalSeconds}s
        </p>
      </div>

      <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
        {placed.map((scene) => (
          <button
            key={scene.index}
            type="button"
            aria-label={`Scene ${scene.index + 1}, ${scene.start}s to ${scene.end}s`}
            onClick={() => onSelect(scene.index)}
            style={{ width: `${(scene.durationSeconds / span) * 100}%` }}
            className={`h-full border-r border-black/40 last:border-r-0 transition-colors ${
              scene.index === activeIndex
                ? "bg-accent"
                : scene.index === pivotIndex
                  ? "bg-accent-secondary/70 hover:bg-accent-secondary"
                  : scene.rendered
                    ? "bg-emerald-400/50 hover:bg-emerald-400/70"
                    : "bg-white/20 hover:bg-white/35"
            }`}
          />
        ))}
      </div>

      <ol className="mt-3 flex flex-col gap-1.5">
        {placed.map((scene) => (
          <li key={scene.index}>
            <button
              type="button"
              onClick={() => onSelect(scene.index)}
              className={`flex w-full items-baseline gap-3 rounded-lg px-2 py-1.5 text-left transition-colors ${
                scene.index === activeIndex ? "bg-accent/10" : "hover:bg-white/[0.04]"
              }`}
            >
              <span className="w-16 shrink-0 font-mono text-[10px] text-grey">
                {scene.start}–{scene.end}s
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[11px] font-semibold text-ink">
                    {scene.setting.trim() || `Scene ${scene.index + 1}`}
                  </span>
                  {scene.index === pivotIndex && (
                    <span className="shrink-0 rounded-full bg-accent-secondary/20 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-accent-secondary">
                      Pivot
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block truncate text-[10px] text-grey">
                  {scene.objective?.trim() || scene.action?.trim() || "Not written yet"}
                </span>
              </span>
              <span className="shrink-0 text-[9px] text-grey">
                {scene.lineCount ? `${scene.lineCount} line${scene.lineCount === 1 ? "" : "s"}` : "silent"}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
