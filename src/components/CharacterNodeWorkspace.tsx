"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Avatar from "@/components/Avatar";
import { buildCharacterSystem, composeCharacterSheetPrompt } from "@/lib/character-system";
import { buildProductionBible } from "@/lib/production-prompting";
import type { Character, CharacterAgeStateId, CharacterSheetViewId } from "@/lib/types";

type NodeId = "canon" | "bible" | "sheet" | "output" | "sound" | "memory" | "performance" | "media";
type Point = { x: number; y: number };
type NodePositions = Record<NodeId, Point>;

const CANVAS = { width: 1580, height: 900 };
const DEFAULT_POSITIONS: NodePositions = {
  canon: { x: 50, y: 250 },
  bible: { x: 370, y: 72 },
  sheet: { x: 705, y: 72 },
  output: { x: 1110, y: 72 },
  sound: { x: 390, y: 560 },
  memory: { x: 735, y: 570 },
  performance: { x: 1110, y: 550 },
  media: { x: 1320, y: 350 },
};

const NODE_SIZES: Record<NodeId, { width: number; height: number }> = {
  canon: { width: 280, height: 345 },
  bible: { width: 300, height: 390 },
  sheet: { width: 365, height: 440 },
  output: { width: 350, height: 410 },
  sound: { width: 300, height: 250 },
  memory: { width: 330, height: 270 },
  performance: { width: 310, height: 270 },
  media: { width: 220, height: 180 },
};

const CONNECTIONS: Array<[NodeId, NodeId]> = [
  ["canon", "bible"],
  ["canon", "sheet"],
  ["bible", "sheet"],
  ["sheet", "output"],
  ["canon", "sound"],
  ["bible", "memory"],
  ["sound", "performance"],
  ["memory", "performance"],
  ["output", "performance"],
  ["output", "media"],
];

function center(position: Point, id: NodeId) {
  const size = NODE_SIZES[id];
  return { x: position.x + size.width / 2, y: position.y + size.height / 2 };
}

function connectionPath(fromId: NodeId, toId: NodeId, positions: NodePositions) {
  const from = center(positions[fromId], fromId);
  const to = center(positions[toId], toId);
  const direction = to.x >= from.x ? 1 : -1;
  const startX = from.x + direction * NODE_SIZES[fromId].width / 2;
  const endX = to.x - direction * NODE_SIZES[toId].width / 2;
  const bend = Math.max(60, Math.abs(endX - startX) * 0.45);
  return `M ${startX} ${from.y} C ${startX + direction * bend} ${from.y}, ${endX - direction * bend} ${to.y}, ${endX} ${to.y}`;
}

function NodeCard({
  id,
  title,
  eyebrow,
  positions,
  onPointerDown,
  children,
  className = "",
}: {
  id: NodeId;
  title: string;
  eyebrow: string;
  positions: NodePositions;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>, id: NodeId) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const position = positions[id];
  const size = NODE_SIZES[id];
  return (
    <section
      className={`character-system-node absolute overflow-hidden rounded-[22px] border border-white/10 bg-[#11190d]/95 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur-xl ${className}`}
      style={{ left: position.x, top: position.y, width: size.width, minHeight: size.height }}
      data-node-id={id}
    >
      <div
        className="character-system-node-handle flex cursor-grab touch-none items-start justify-between gap-3 border-b border-white/8 px-4 py-3 active:cursor-grabbing"
        onPointerDown={(event) => onPointerDown(event, id)}
      >
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-accent">{eyebrow}</p>
          <h2 className="mt-1 text-sm font-semibold text-ink">{title}</h2>
        </div>
        <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-white/10 text-[11px] text-grey">••</span>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function TinyStatus({ children, active = false }: { children: React.ReactNode; active?: boolean }) {
  return (
    <span className={`rounded-full border px-2 py-1 text-[8px] font-bold uppercase tracking-[0.12em] ${
      active ? "border-[#07d2be]/45 bg-[#07d2be]/10 text-[#36e0cd]" : "border-white/10 text-grey"
    }`}>
      {children}
    </span>
  );
}

export default function CharacterNodeWorkspace({ character }: { character: Character }) {
  const bible = useMemo(() => buildProductionBible(character), [character]);
  const system = useMemo(
    () => bible.system ?? buildCharacterSystem(character, bible),
    [bible, character],
  );
  const storageKey = `chaplin:character-system-layout:${character.id}`;
  const [positions, setPositions] = useState<NodePositions>(DEFAULT_POSITIONS);
  useEffect(() => {
    let savedPositions: NodePositions | null = null;
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) savedPositions = { ...DEFAULT_POSITIONS, ...JSON.parse(saved) as Partial<NodePositions> };
    } catch {
      // A corrupt personal layout should never block the character workspace.
    }
    if (!savedPositions) return;
    const frame = window.requestAnimationFrame(() => setPositions(savedPositions));
    return () => window.cancelAnimationFrame(frame);
  }, [storageKey]);
  const [viewId, setViewId] = useState<CharacterSheetViewId>(system.sheet.canonicalViewId);
  const [ageId, setAgeId] = useState<CharacterAgeStateId>(system.sheet.canonicalAgeStateId);
  const [copied, setCopied] = useState(false);
  const dragRef = useRef<{
    id: NodeId;
    offsetX: number;
    offsetY: number;
    canvasLeft: number;
    canvasTop: number;
  } | null>(null);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || window.innerWidth < 768) return;
      const nextX = Math.max(10, Math.min(
        CANVAS.width - NODE_SIZES[drag.id].width - 10,
        event.clientX - drag.offsetX - drag.canvasLeft,
      ));
      const nextY = Math.max(10, Math.min(
        CANVAS.height - NODE_SIZES[drag.id].height - 10,
        event.clientY - drag.offsetY - drag.canvasTop,
      ));
      setPositions((current) => {
        const next = { ...current, [drag.id]: { x: nextX, y: nextY } };
        window.localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
    };
    const stop = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, [storageKey]);

  function beginDrag(event: ReactPointerEvent<HTMLDivElement>, id: NodeId) {
    if (window.innerWidth < 768) return;
    const node = event.currentTarget.closest<HTMLElement>("[data-node-id]");
    const canvas = event.currentTarget.closest<HTMLElement>(".character-system-canvas");
    if (!node || !canvas) return;
    const rect = node.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    dragRef.current = {
      id,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      canvasLeft: canvasRect.left,
      canvasTop: canvasRect.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  const sheetPrompt = useMemo(
    () => composeCharacterSheetPrompt(character, bible, { viewId, ageStateId: ageId }),
    [ageId, bible, character, viewId],
  );
  const mediaCount = (character.galleryUrls?.length ?? 0) + (character.imageUrl ? 1 : 0) + (character.videoUrl ? 1 : 0);
  const canonicalImage = character.imageUrl ?? character.bannerUrl;

  async function copyPrompt() {
    await navigator.clipboard.writeText(sheetPrompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function resetLayout() {
    setPositions(DEFAULT_POSITIONS);
    window.localStorage.setItem(storageKey, JSON.stringify(DEFAULT_POSITIONS));
  }

  return (
    <div className="min-h-screen bg-[#080d05] text-ink">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#080d05]/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href={`/characters/${character.id}`} className="rounded-full border border-white/10 px-3 py-2 text-[10px] font-semibold text-grey hover:text-ink">
              ← Profile
            </Link>
            <Avatar hue={character.avatarHue} label={character.name} src={canonicalImage} size={38} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{character.name}</p>
              <p className="text-[9px] uppercase tracking-[0.2em] text-[#36e0cd]">Character system</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TinyStatus active>Canon connected</TinyStatus>
            <button
              type="button"
              onClick={resetLayout}
              className="hidden rounded-full border border-white/10 px-3 py-2 text-[9px] font-semibold text-grey hover:text-ink sm:block"
            >
              Reset layout
            </button>
          </div>
        </div>
      </header>

      <div className="border-b border-white/8 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-[1680px] flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-accent">Identity operating system</p>
            <h1 className="mt-1 font-serif text-2xl sm:text-3xl">Every output returns to one actor.</h1>
          </div>
          <p className="max-w-xl text-xs leading-5 text-grey">
            Drag the graph to inspect how canon becomes reference sheets, voice, memory, performances, and reusable media.
          </p>
        </div>
      </div>

      <div className="character-system-scroll overflow-auto">
        <div
          className="character-system-canvas relative"
          style={{ width: CANVAS.width, minHeight: CANVAS.height }}
        >
          <svg className="character-system-connections pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
            <defs>
              <linearGradient id="character-system-line" x1="0" x2="1">
                <stop offset="0" stopColor="#f24e70" stopOpacity=".65" />
                <stop offset="1" stopColor="#07d2be" stopOpacity=".7" />
              </linearGradient>
            </defs>
            {CONNECTIONS.map(([from, to]) => (
              <g key={`${from}-${to}`}>
                <path d={connectionPath(from, to, positions)} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="7" />
                <path d={connectionPath(from, to, positions)} fill="none" stroke="url(#character-system-line)" strokeWidth="1.5" />
              </g>
            ))}
          </svg>

          <NodeCard id="canon" title={character.name} eyebrow="Canonical actor" positions={positions} onPointerDown={beginDrag}>
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-white/10 bg-black/25">
              {canonicalImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={canonicalImage} alt={character.name} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center"><Avatar hue={character.avatarHue} label={character.name} size={88} /></div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-10">
                <p className="text-xs font-semibold">{character.tagline}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <TinyStatus active>Identity seed</TinyStatus>
              <TinyStatus>{character.archetype}</TinyStatus>
              <TinyStatus>{bible.visual.medium || "live action"}</TinyStatus>
            </div>
            <p className="mt-3 text-[10px] leading-4 text-grey">
              The face, proportions, hair, and signature details in this image govern every downstream frame.
            </p>
          </NodeCard>

          <NodeCard id="bible" title="Actor direction bible" eyebrow="Dramatic engine" positions={positions} onPointerDown={beginDrag}>
            <div className="space-y-3 text-[10px] leading-4">
              <div><p className="font-bold uppercase tracking-wider text-accent">Wants</p><p className="mt-1 text-grey">{bible.dramatic.externalWant}</p></div>
              <div><p className="font-bold uppercase tracking-wider text-[#36e0cd]">Needs</p><p className="mt-1 text-grey">{bible.dramatic.innerNeed}</p></div>
              <div><p className="font-bold uppercase tracking-wider text-[#f7d94c]">Contradiction</p><p className="mt-1 text-grey">{bible.dramatic.contradiction}</p></div>
              <div className="rounded-xl border border-white/8 bg-black/15 p-3">
                <p className="font-semibold text-ink">Recognition locks</p>
                <ol className="mt-2 space-y-1 text-grey">
                  {(bible.visual.recognitionLocks ?? bible.visual.continuityRules).slice(0, 4).map((lock, index) => (
                    <li key={lock}>{index + 1}. {lock}</li>
                  ))}
                </ol>
              </div>
            </div>
          </NodeCard>

          <NodeCard id="sheet" title="Reference sheet generator" eyebrow="Visual continuity" positions={positions} onPointerDown={beginDrag}>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[9px] font-bold uppercase tracking-wider text-grey">
                View
                <select value={viewId} onChange={(event) => setViewId(event.target.value as CharacterSheetViewId)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#080d05] px-2 py-2 text-[10px] normal-case tracking-normal text-ink">
                  {system.sheet.views.map((view) => <option key={view.id} value={view.id}>{view.label}</option>)}
                </select>
              </label>
              <label className="text-[9px] font-bold uppercase tracking-wider text-grey">
                Age
                <select value={ageId} onChange={(event) => setAgeId(event.target.value as CharacterAgeStateId)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#080d05] px-2 py-2 text-[10px] normal-case tracking-normal text-ink">
                  {system.sheet.ageStates.map((age) => <option key={age.id} value={age.id}>{age.label}</option>)}
                </select>
              </label>
            </div>
            <pre className="character-system-prompt mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl border border-white/8 bg-black/25 p-3 font-sans text-[9px] leading-4 text-grey">
              {sheetPrompt}
            </pre>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={copyPrompt} className="flex-1 rounded-full bg-accent px-3 py-2 text-[10px] font-bold text-[#090b08]">
                {copied ? "Copied" : "Copy provider prompt"}
              </button>
              <Link href={`/characters/${character.id}#production-studio`} className="rounded-full border border-white/15 px-3 py-2 text-[10px] font-semibold">
                Generate
              </Link>
            </div>
          </NodeCard>

          <NodeCard id="output" title="Character sheet" eyebrow="8 views × 3 ages" positions={positions} onPointerDown={beginDrag}>
            <div className="grid grid-cols-3 gap-2">
              {system.sheet.views.map((view, index) => {
                const image = character.galleryUrls?.[index] ?? canonicalImage;
                return (
                  <button key={view.id} type="button" onClick={() => setViewId(view.id)} className={`relative aspect-square overflow-hidden rounded-lg border text-left ${viewId === view.id ? "border-accent" : "border-white/8"}`}>
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image} alt="" className={`h-full w-full object-cover ${index > (character.galleryUrls?.length ?? 0) ? "opacity-25" : ""}`} />
                    ) : <span className="grid h-full place-items-center text-grey">+</span>}
                    <span className="absolute inset-x-0 bottom-0 bg-black/70 px-1.5 py-1 text-[7px] font-bold uppercase">{view.label}</span>
                  </button>
                );
              })}
              <div className="grid aspect-square place-items-center rounded-lg border border-dashed border-white/12 text-center text-[8px] uppercase tracking-wider text-grey">
                Wardrobe<br />breakdown
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {system.sheet.ageStates.map((age) => (
                <button key={age.id} type="button" onClick={() => setAgeId(age.id)} className={`rounded-full border px-2 py-1 text-[8px] font-bold uppercase ${ageId === age.id ? "border-[#07d2be] text-[#36e0cd]" : "border-white/10 text-grey"}`}>
                  {age.label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[10px] leading-4 text-grey">
              Existing outputs fill these slots. Empty views remain generation targets tied to the same identity seed.
            </p>
          </NodeCard>

          <NodeCard id="sound" title="Voice & sound identity" eyebrow="Locked performance" positions={positions} onPointerDown={beginDrag}>
            <div className="space-y-3">
              <div className="rounded-xl border border-white/8 p-3">
                <div className="flex items-center justify-between"><p className="text-[10px] font-semibold">Voice</p><TinyStatus active={Boolean(character.voiceId)}>{character.voiceId ? "Locked" : "Draft"}</TinyStatus></div>
                <p className="mt-2 line-clamp-3 text-[9px] leading-4 text-grey">{character.voiceDesc}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-white/8 p-3"><p className="text-[9px] font-semibold">SFX</p><p className="mt-1 line-clamp-2 text-[8px] text-grey">{character.sfxDesc}</p></div>
                <div className="rounded-xl border border-white/8 p-3"><p className="text-[9px] font-semibold">Theme</p><p className="mt-1 line-clamp-2 text-[8px] text-grey">{character.themeDesc}</p></div>
              </div>
            </div>
          </NodeCard>

          <NodeCard id="memory" title="Memory & interaction" eyebrow="Living character" positions={positions} onPointerDown={beginDrag}>
            <p className="text-[10px] leading-4 text-grey">{system.interaction.firstPersonSelfConcept}</p>
            <div className="mt-3 rounded-xl border border-white/8 bg-black/15 p-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-[#36e0cd]">Writable memory</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {system.memory.writableMemoryTypes.map((type) => <TinyStatus key={type}>{type}</TinyStatus>)}
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-[9px] text-grey">
              <span>Recent recall {system.memory.retrieveRecent}</span>
              <span>Salient recall {system.memory.retrieveSalient}</span>
            </div>
            <p className="mt-3 text-[9px] leading-4 text-grey">Creator-private instructions, identity locks, and unverified relationships cannot be written into memory.</p>
          </NodeCard>

          <NodeCard id="performance" title="Scene performance" eyebrow="Production output" positions={positions} onPointerDown={beginDrag}>
            <p className="text-[10px] leading-4 text-grey">
              The scene pipeline reads identity, pressure behavior, locked voice, canonical reference, and retrieved memory before generating a shot.
            </p>
            <div className="mt-3 space-y-2">
              {["Still frame", "Silent motion", "Voice + sound", "Approval"].map((step, index) => (
                <div key={step} className="flex items-center gap-2 text-[9px]">
                  <span className={`h-2 w-2 rounded-full ${index === 0 ? "bg-[#07d2be]" : "bg-white/15"}`} />
                  <span>{step}</span>
                </div>
              ))}
            </div>
            <Link href={`/characters/${character.id}#production-studio`} className="mt-4 block rounded-full bg-accent px-4 py-2.5 text-center text-[10px] font-bold text-[#090b08]">
              Open production studio →
            </Link>
          </NodeCard>

          <NodeCard id="media" title="Media library" eyebrow="Reusable assets" positions={positions} onPointerDown={beginDrag}>
            <p className="font-serif text-3xl">{mediaCount}</p>
            <p className="mt-1 text-[9px] uppercase tracking-wider text-grey">connected assets</p>
            <div className="mt-4 flex flex-wrap gap-1"><TinyStatus>Cover</TinyStatus><TinyStatus>Stills</TinyStatus><TinyStatus>Video</TinyStatus></div>
            <Link href={`/characters/${character.id}`} className="mt-4 block text-[9px] font-semibold text-accent">Review on profile →</Link>
          </NodeCard>
        </div>
      </div>
    </div>
  );
}
