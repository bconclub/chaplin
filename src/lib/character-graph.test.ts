import assert from "node:assert/strict";
import test from "node:test";
import { buildCharacterGraph } from "@/lib/character-graph";
import { CHARACTER_CARD_V2_ROUTING } from "@/lib/character-card";
import type { Character } from "@/lib/types";

const bare = { id: "c-1", name: "Ru Ansari", archetype: "outsider" } as Character;

test("the character is the single root and every source hangs off it", () => {
  const graph = buildCharacterGraph(bare);
  const roots = graph.nodes.filter((node) => node.kind === "character");
  assert.equal(roots.length, 1);
  for (const source of graph.nodes.filter((node) => node.kind === "source")) {
    assert.ok(
      graph.edges.some((edge) => edge.from === "character" && edge.to === source.id),
      `${source.label} is not connected to the character`,
    );
  }
});

test("every edge points at a node that exists", () => {
  const graph = buildCharacterGraph(bare);
  const ids = new Set(graph.nodes.map((node) => node.id));
  for (const edge of graph.edges) {
    assert.ok(ids.has(edge.from), `dangling edge source ${edge.from}`);
    assert.ok(ids.has(edge.to), `dangling edge target ${edge.to}`);
  }
});

test("card edges match the routing contract exactly — the graph cannot lie about behaviour", () => {
  const graph = buildCharacterGraph(bare);
  for (const [path, consumers] of Object.entries(CHARACTER_CARD_V2_ROUTING)) {
    const from = `card:${path}`;
    if (!graph.nodes.some((node) => node.id === from)) continue;
    const drawn = graph.edges
      .filter((edge) => edge.from === from && edge.to.startsWith("consumer:"))
      .map((edge) => edge.to.replace("consumer:", ""))
      .sort();
    assert.deepEqual(drawn, [...consumers].sort(), `${path} routing drawn incorrectly`);
  }
});

test("writing-only knowledge never reaches an image or video generator", () => {
  const graph = buildCharacterGraph(bare);
  for (const path of ["card:dramatic_engine", "card:story_grammar"]) {
    const targets = graph.edges.filter((edge) => edge.from === path).map((edge) => edge.to);
    assert.ok(!targets.includes("consumer:image"), `${path} leaked to image`);
    assert.ok(!targets.includes("consumer:video"), `${path} leaked to video`);
  }
});

test("a character with no card or bible reports every source empty", () => {
  const graph = buildCharacterGraph(bare);
  const sources = graph.nodes.filter((node) => node.kind === "source");
  assert.ok(sources.length > 0);
  assert.ok(sources.every((node) => node.empty), "an empty character should not claim to hold content");
});

test("populated fields are surfaced as real content, not just structure", () => {
  const withBible = {
    ...bare,
    productionBible: {
      version: 1,
      dramatic: { contradiction: "sells certainty, believes none of it" },
      performance: { underPressure: "goes very still" },
      visual: { wardrobe: "maroon kurta, worn collar" },
      cinematography: { lens: "50mm" },
      story: { hookPattern: "opens mid-transaction" },
    },
  } as unknown as Character;
  const graph = buildCharacterGraph(withBible);
  const visual = graph.nodes.find((node) => node.id === "bible:visual");
  assert.equal(visual?.empty, false, "a populated source must not be marked empty");
  assert.match(String(visual?.value), /maroon kurta/);
});

test("the same character always draws the same graph", () => {
  const a = buildCharacterGraph(bare);
  const b = buildCharacterGraph(bare);
  assert.deepEqual(a.edges, b.edges);
  assert.deepEqual(a.nodes.map((n) => n.id), b.nodes.map((n) => n.id));
});
