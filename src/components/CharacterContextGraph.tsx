"use client";

import { useMemo, useState } from "react";
import type { CharacterGraph, GraphNode } from "@/lib/character-graph";

type Placed = GraphNode & { x: number; y: number; r: number };

const WIDTH = 1000;
const HEIGHT = 640;

const TONE: Record<string, { fill: string; stroke: string; text: string }> = {
  character: { fill: "rgba(242,78,112,0.22)", stroke: "var(--accent)", text: "var(--ink)" },
  source: { fill: "rgba(255,255,255,0.05)", stroke: "rgba(255,255,255,0.22)", text: "var(--ink)" },
  consumer: { fill: "rgba(7,210,190,0.14)", stroke: "var(--accent-secondary)", text: "var(--ink)" },
};

/**
 * The character's knowledge as a graph rather than a form.
 *
 * A creator can see a Bible and a Card, but not which part of them reaches
 * which generator — so "why did the image come out like that" has no visible
 * answer. Edges here are read from CHARACTER_CARD_V2_ROUTING, the same contract
 * the prompt builders enforce, so the picture cannot drift from behaviour.
 *
 * Layout is deterministic polar placement rather than a physics simulation:
 * the same character always draws the same graph, and it needs no dependency.
 */
export default function CharacterContextGraph({ graph }: { graph: CharacterGraph }) {
  const [active, setActive] = useState<string | null>(null);

  const placed = useMemo<Placed[]>(() => {
    const sources = graph.nodes.filter((n) => n.kind === "source");
    const consumers = graph.nodes.filter((n) => n.kind === "consumer");
    const cx = WIDTH / 2;
    const cy = HEIGHT / 2;

    const out: Placed[] = [{ ...graph.nodes.find((n) => n.kind === "character")!, x: cx, y: cy, r: 42 }];

    // Sources on the inner ring, consumers on the outer — so every edge reads
    // outward: character → what it knows → what that knowledge produces.
    sources.forEach((node, index) => {
      const angle = (index / sources.length) * Math.PI * 2 - Math.PI / 2;
      out.push({ ...node, x: cx + Math.cos(angle) * 195, y: cy + Math.sin(angle) * 165, r: node.empty ? 14 : 20 });
    });
    consumers.forEach((node, index) => {
      const angle = (index / consumers.length) * Math.PI * 2 - Math.PI / 2;
      out.push({ ...node, x: cx + Math.cos(angle) * 400, y: cy + Math.sin(angle) * 275, r: 28 });
    });
    return out;
  }, [graph]);

  const byId = useMemo(() => new Map(placed.map((n) => [n.id, n])), [placed]);

  /** A node is lit when it is hovered or directly connected to what is. */
  const lit = useMemo(() => {
    if (!active) return null;
    const set = new Set<string>([active]);
    for (const edge of graph.edges) {
      if (edge.from === active) set.add(edge.to);
      if (edge.to === active) set.add(edge.from);
    }
    return set;
  }, [active, graph.edges]);

  const focused = active ? byId.get(active) : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Where this character's context comes from">
        <g>
          {graph.edges.map((edge) => {
            const a = byId.get(edge.from);
            const b = byId.get(edge.to);
            if (!a || !b) return null;
            const on = !lit || (lit.has(edge.from) && lit.has(edge.to));
            const midX = (a.x + b.x) / 2;
            const midY = (a.y + b.y) / 2 - 26;
            return (
              <path
                key={`${edge.from}->${edge.to}`}
                d={`M ${a.x} ${a.y} Q ${midX} ${midY} ${b.x} ${b.y}`}
                fill="none"
                stroke={on ? "rgba(255,255,255,0.30)" : "rgba(255,255,255,0.05)"}
                strokeWidth={on && lit ? 1.6 : 0.9}
              />
            );
          })}
        </g>

        {placed.map((node) => {
          const tone = TONE[node.kind];
          const on = !lit || lit.has(node.id);
          return (
            <g
              key={node.id}
              transform={`translate(${node.x} ${node.y})`}
              opacity={on ? 1 : 0.2}
              onMouseEnter={() => setActive(node.id)}
              onMouseLeave={() => setActive(null)}
              className="cursor-pointer transition-opacity"
            >
              <circle
                r={node.r}
                fill={tone.fill}
                stroke={node.empty ? "rgba(255,255,255,0.14)" : tone.stroke}
                strokeWidth={node.kind === "character" ? 2 : 1.2}
                strokeDasharray={node.empty ? "3 3" : undefined}
              />
              <text
                y={node.r + 14}
                textAnchor="middle"
                fill={tone.text}
                fontSize={node.kind === "character" ? 15 : 11}
                fontWeight={node.kind === "character" ? 700 : 500}
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Detail rail — the graph answers "what is connected", this answers "with what". */}
      <div className="mt-2 min-h-[4.5rem] rounded-xl border border-line bg-black/25 p-3">
        {focused ? (
          <>
            <p className="text-[11px] font-semibold text-ink">{focused.label}</p>
            <p className="mt-0.5 text-[10.5px] text-grey">{focused.detail}</p>
            {focused.value
              ? <p className="mt-1.5 text-[11px] leading-5 text-accent-secondary">{focused.value}</p>
              : focused.kind === "source" && <p className="mt-1.5 text-[11px] text-amber-300">Empty — nothing to give the generators yet.</p>}
          </>
        ) : (
          <p className="text-[10.5px] text-grey">
            Hover any node to see what it holds and what it feeds. Dashed rings are empty.
          </p>
        )}
      </div>

      {graph.orphans.length > 0 && (
        <p className="mt-2 rounded-lg border border-amber-400/35 bg-amber-400/10 p-2.5 text-[10.5px] text-amber-200">
          <strong>{graph.orphans.length} unused:</strong> {graph.orphans.join(", ")} — held on the character but reaching no generator.
        </p>
      )}
    </div>
  );
}
