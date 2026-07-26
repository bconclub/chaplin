import assert from "node:assert/strict";
import test from "node:test";
import { segmentBody } from "@/components/feed/FeedBody";
import { applyFeedTab, trendingTags, type FeedTabId } from "@/components/feed/feed-tabs";
import type { Character } from "@/lib/types";
import type { FeedPost } from "@/lib/feed-types";

const actor = (id: string, name: string) => ({ id, name }) as Character;

const CAST = [
  actor("c-sprocket", "Sprocket"),
  actor("c-benson", "Boxer Benson"),
  actor("c-ru", 'Rukhsar "Ru" Ansari'),
];

const linked = (body: string) =>
  segmentBody(body, CAST).filter((segment) => segment.character).map((segment) => segment.character!.name);

test("cast names in a post body become links", () => {
  assert.deepEqual(linked("Cast: Sprocket, Boxer Benson"), ["Sprocket", "Boxer Benson"]);
});

test("the full body text is preserved exactly", () => {
  const body = "Script locked: Curfew Tax\nCast: Sprocket, Boxer Benson";
  assert.equal(segmentBody(body, CAST).map((segment) => segment.text).join(""), body);
});

test("longer names win over shorter names inside them", () => {
  // "Benson" alone must not beat "Boxer Benson".
  const segments = segmentBody("Boxer Benson lands the punch", CAST);
  assert.equal(segments[0].character?.name, "Boxer Benson");
});

test("a name is not matched inside a longer word", () => {
  assert.deepEqual(linked("Sprocketeering is not a word"), []);
});

test("names with punctuation are matched safely", () => {
  assert.deepEqual(linked('Rukhsar "Ru" Ansari steps in'), ['Rukhsar "Ru" Ansari']);
});

test("matching is case insensitive but keeps the original text", () => {
  const segments = segmentBody("sprocket arrives", CAST);
  assert.equal(segments[0].character?.id, "c-sprocket");
  assert.equal(segments[0].text, "sprocket");
});

// ---- tab filtering -----------------------------------------------------------

const post = (over: Partial<FeedPost>) => ({
  id: "p", body: "", mediaKind: null, mediaUrl: null, createdAt: "2026-07-26T00:00:00Z",
  author: { id: "u1", name: "A", handle: "@a", avatarInitial: "A", avatarHue: 1, imageUrl: null },
  sharedPostId: null, seriesId: null, episodeId: null, replyCount: 0, reactionCount: 0,
  shareCount: 0, viewerHasLiked: false, replies: [], sharedPost: null, ...over,
}) as FeedPost;

test("AI Shorts shows only video posts", () => {
  const posts = [post({ id: "v", mediaKind: "video" }), post({ id: "i", mediaKind: "image" })];
  assert.deepEqual(applyFeedTab(posts, "shorts", "me").map((p) => p.id), ["v"]);
});

test("Microdramas shows locked productions", () => {
  const posts = [post({ id: "prod", body: "Script locked: Curfew Tax" }), post({ id: "chat", body: "hello" })];
  assert.deepEqual(applyFeedTab(posts, "microdramas", "me").map((p) => p.id), ["prod"]);
});

test("Trending ranks by engagement, not recency", () => {
  const posts = [post({ id: "quiet" }), post({ id: "loud", reactionCount: 10, replyCount: 4 })];
  assert.equal(applyFeedTab(posts, "trending", "me")[0].id, "loud");
});

test("Following is empty until the viewer likes something", () => {
  const posts = [post({ id: "a" }), post({ id: "b" })];
  assert.equal(applyFeedTab(posts, "following", "me").length, 0);
});

test("Following collects other posts by creators the viewer liked", () => {
  const posts = [
    post({ id: "liked", viewerHasLiked: true, author: { ...post({}).author, id: "u2" } }),
    post({ id: "same-author", author: { ...post({}).author, id: "u2" } }),
    post({ id: "other", author: { ...post({}).author, id: "u3" } }),
  ];
  assert.deepEqual(applyFeedTab(posts, "following", "me").map((p) => p.id).sort(), ["liked", "same-author"]);
});

test("every tab returns an array", () => {
  const tabs: FeedTabId[] = ["for-you", "following", "trending", "new", "microdramas", "shorts", "behind"];
  for (const tab of tabs) assert.ok(Array.isArray(applyFeedTab([post({})], tab, "me")), tab);
});

test("trending tags are counted from real post bodies", () => {
  const posts = [post({ body: "#CyberNoir #AIActors" }), post({ body: "#CyberNoir again" })];
  assert.deepEqual(trendingTags(posts, 2), [{ tag: "#CyberNoir", count: 2 }, { tag: "#AIActors", count: 1 }]);
});
