"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Avatar from "@/components/Avatar";
import FeedBody, { segmentBody } from "@/components/feed/FeedBody";
import { FEED_TABS, EMPTY_TAB_COPY, applyFeedTab, trendingTags, type FeedTabId } from "@/components/feed/feed-tabs";
import MediaPlayer from "@/components/MediaPlayer";
import { useChaplinStore } from "@/lib/store";
import type { FeedMediaKind, FeedPost, FeedReply, SharedFeedPost } from "@/lib/feed-types";
import type { Character } from "@/lib/types";
import { getClientAuthIdentity } from "@/lib/client-auth";
import { buildFeedShareCopy } from "@/lib/feed-share";
import { ARCHETYPE_LABEL, compactNumber } from "@/lib/format";

function relativeTime(value: string) {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

/*
  A post's media is one actor's work, so it is labelled with that actor rather
  than "Creator video". The name is taken from the post's own first mention -
  the same resolution the body already uses to render the cyan link - because a
  feed post carries an author but no character reference.
*/
function FeedMedia({
  kind,
  url,
  compact = false,
  body = "",
  characters = [],
}: {
  kind: FeedMediaKind;
  url: string;
  compact?: boolean;
  body?: string;
  characters?: Character[];
}) {
  const subject = segmentBody(body, characters).find((segment) => segment.character)?.character ?? null;
  /*
    Media in the feed plays where it sits. Wrapping the player in a link made a
    click navigate away instead of starting playback, which is the opposite of
    what a feed is for - the actor is reachable from the name in the post body,
    which is already a link.
  */
  if (kind === "video") {
    return <MediaPlayer src={url} label={subject ? `${subject.name} scene` : "Creator video"} kind="video" compact />;
  }
  if (kind === "audio") {
    return <MediaPlayer src={url} label={subject ? `${subject.name} audio` : "Creator audio"} kind="audio" compact />;
  }
  // A still has nothing to play, so it stays a link to the actor it shows.
  const image = (
    // User-posted media can come from any HTTPS host, so it cannot use a static Next Image allowlist.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={subject ? `${subject.name} still` : "Post attachment"} className={`w-full object-cover ${compact ? "max-h-56" : "max-h-[34rem]"}`} />
  );
  return subject ? <Link href={`/characters/${subject.id}`} className="block">{image}</Link> : image;
}

type LockedProductionSummary = {
  title: string;
  sceneCount: number;
  runtime: string;
  format: string;
  castNames: string[];
  logline: string;
};

function lockedProductionSummary(body: string): LockedProductionSummary | null {
  const lines = body.split("\n").map((line) => line.trim()).filter(Boolean);
  const title = lines[0]?.match(/^Script locked:\s*(.+)$/i)?.[1]?.trim();
  if (!title) return null;
  const productionLine = lines[1]?.match(/^(\d+)\s+playable scenes?\s*·\s*([^ ]+)\s+(.+)$/i);
  const castLineIndex = lines.findIndex((line) => /^Cast:\s*/i.test(line));
  const castNames = castLineIndex >= 0
    ? lines[castLineIndex].replace(/^Cast:\s*/i, "").split(",").map((name) => name.trim()).filter(Boolean)
    : [];
  return {
    title,
    sceneCount: Number(productionLine?.[1] ?? 0),
    runtime: productionLine?.[2] ?? "",
    format: productionLine?.[3] ?? "Production",
    castNames,
    logline: lines.slice(castLineIndex >= 0 ? castLineIndex + 1 : 2).join(" "),
  };
}

function ProductionFeedPoster({
  summary,
  cast,
  href,
  productImageUrl,
}: {
  summary: LockedProductionSummary;
  cast: Character[];
  href?: string;
  productImageUrl?: string;
}) {
  const visibleCast = cast.slice(0, 4);
  const poster = (
    <div className="group relative aspect-[16/9] overflow-hidden rounded-xl border border-white/15 bg-[#080b08] shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
      <div
        className={`absolute inset-0 grid ${
          visibleCast.length <= 1
            ? "grid-cols-1"
            : visibleCast.length === 2
              ? "grid-cols-2"
              : "grid-cols-2 grid-rows-2"
        }`}
      >
        {visibleCast.length ? visibleCast.map((character, index) => {
          const image = character.bannerUrl ?? character.imageUrl ?? character.galleryUrls?.[0];
          return (
            <div key={character.id} className="relative min-h-0 min-w-0 overflow-hidden">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element -- approved actor art is served from dynamic media hosts
                <img
                  src={image}
                  alt=""
                  className={`h-full w-full object-cover transition duration-700 group-hover:scale-[1.025] ${
                    visibleCast.length === 2 && index === 0 ? "object-[55%_center]" : "object-center"
                  }`}
                />
              ) : (
                <div
                  className="flex h-full items-center justify-center text-5xl font-semibold text-white/50"
                  style={{ background: `hsl(${character.avatarHue} 32% 16%)` }}
                >
                  {character.name.slice(0, 1)}
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/15" />
            </div>
          );
        }) : (
          <div className="h-full w-full bg-[radial-gradient(circle_at_70%_20%,rgba(45,211,186,0.2),transparent_42%),linear-gradient(135deg,#171109,#06160e)]" />
        )}
      </div>

      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/28 to-black/25" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-black/45" />
      <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-accent via-accent-secondary to-transparent" />

      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 sm:p-4">
        <span className="rounded-full border border-white/20 bg-black/45 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-md">
          Chaplin original
        </span>
        <span className="rounded-full border border-accent/45 bg-black/55 px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-accent backdrop-blur-md">
          {summary.runtime} · {summary.sceneCount || "—"} scenes
        </span>
      </div>

      {productImageUrl && (
        <div className="absolute right-3 top-12 h-14 w-14 overflow-hidden rounded-lg border border-white/30 bg-white/90 p-1 shadow-xl sm:right-4 sm:top-14 sm:h-16 sm:w-16">
          {/* eslint-disable-next-line @next/next/no-img-element -- uploaded product reference uses a dynamic CDN URL */}
          <img src={productImageUrl} alt="Product featured in this production" className="h-full w-full rounded-md object-contain" />
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
        <p className="text-[8px] font-semibold uppercase tracking-[0.22em] text-accent-secondary">
          {summary.format}
        </p>
        <h3 className="mt-1 max-w-[80%] font-serif text-2xl leading-none text-white sm:text-3xl">
          {summary.title}
        </h3>
        {summary.logline && (
          <p className="mt-2 line-clamp-2 max-w-[78%] text-[10px] leading-4 text-white/70 sm:text-xs">
            {summary.logline}
          </p>
        )}
        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {summary.castNames.slice(0, 4).map((name) => (
              <span key={name} className="rounded-full border border-white/15 bg-black/45 px-2 py-1 text-[8px] font-semibold uppercase tracking-wide text-white/85 backdrop-blur">
                {name}
              </span>
            ))}
          </div>
          {href && (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-accent/70 bg-accent text-sm text-white shadow-[0_0_24px_rgba(244,70,112,0.4)] transition group-hover:scale-105">
              ▶
            </span>
          )}
        </div>
      </div>
    </div>
  );

  return href ? <Link href={href} aria-label={`Open ${summary.title}`}>{poster}</Link> : poster;
}

function SharedPostCard({ post, characters = [] }: { post: SharedFeedPost; characters?: Character[] }) {
  return <div className="mt-3 overflow-hidden rounded-lg border border-line bg-black/15">
    <div className="flex items-center gap-2 p-3">
      <Avatar hue={post.author.avatarHue} label={post.author.name} src={post.author.imageUrl ?? undefined} size={28} />
      <p className="min-w-0 text-xs"><span className="font-semibold">{post.author.name}</span> <span className="text-grey">{post.author.handle}</span></p>
    </div>
    {post.body && <p className="px-3 pb-3 text-sm leading-5">{post.body}</p>}
    {post.mediaKind && post.mediaUrl && <FeedMedia kind={post.mediaKind} url={post.mediaUrl} compact body={post.body} characters={characters} />}
  </div>;
}

function ReplyRow({ reply, onReply }: { reply: FeedReply; onReply: (reply: FeedReply) => void }) {
  return <div className={`relative flex gap-3 py-3 ${reply.parentReplyId ? "ml-8 border-l border-line pl-4" : ""}`}>
    <Avatar hue={reply.author.avatarHue} label={reply.author.name} src={reply.author.imageUrl ?? undefined} size={30} />
    <div className="min-w-0 flex-1">
      <p className="text-xs"><span className="font-semibold">{reply.author.name}</span> <span className="text-grey">{reply.author.handle} · {relativeTime(reply.createdAt)}</span></p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-5">{reply.body}</p>
      <button type="button" onClick={() => onReply(reply)} className="mt-1 text-[10px] font-semibold text-grey hover:text-accent">Reply</button>
    </div>
  </div>;
}

function PostCard({ post, currentUserId, refresh, expanded }: { post: FeedPost; currentUserId: string; refresh: () => Promise<void>; expanded?: boolean }) {
  const stories = useChaplinStore((state) => state.stories);
  const characters = useChaplinStore((state) => state.characters);
  const characterNames = useMemo(
    () => characters.map((character) => character.name),
    [characters],
  );
  const [replying, setReplying] = useState(Boolean(expanded));
  const [replyBody, setReplyBody] = useState("");
  const [parentReply, setParentReply] = useState<FeedReply | null>(null);
  const [busy, setBusy] = useState(false);

  async function action(url: string, body: object) {
    setBusy(true);
    try {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json() as { error?: string };
      if (response.status === 401) {
        window.location.assign("/auth");
        return;
      }
      if (!response.ok) throw new Error(data.error || "The feed could not be updated.");
      await refresh();
    } finally { setBusy(false); }
  }

  async function sendReply() {
    if (!replyBody.trim()) return;
    await action("/api/feed/replies", { postId: post.id, authorId: currentUserId, body: replyBody, parentReplyId: parentReply?.id });
    setReplyBody("");
    setParentReply(null);
    setReplying(true);
  }

  async function copyShare() {
    const url = `${window.location.origin}/feed/${post.id}`;
    const shareCopy = buildFeedShareCopy(post, characterNames);
    if (navigator.share) {
      await navigator.share({
        title: shareCopy.title,
        text: shareCopy.text,
        url,
      });
    } else {
      await navigator.clipboard.writeText(`${shareCopy.text}\n\n${url}`);
    }
  }

  const topReplies = post.replies.filter((reply) => !reply.parentReplyId);
  const children = new Map<string, FeedReply[]>();
  for (const reply of post.replies.filter((item) => item.parentReplyId)) {
    const list = children.get(reply.parentReplyId!) ?? [];
    list.push(reply);
    children.set(reply.parentReplyId!, list);
  }
  const linkedProduction = stories.find((story) => post.body.startsWith(`Script locked: ${story.title}\n`));
  const productionSummary = lockedProductionSummary(post.body);
  const productionCast = productionSummary
    ? productionSummary.castNames
      .map((name) => characters.find((character) => character.name.toLowerCase() === name.toLowerCase()))
      .filter((character): character is Character => Boolean(character))
    : [];

  return <article data-feed-post={post.id} className="border-b border-line bg-paper px-4 py-6 sm:px-0">
    <div className="flex gap-3">
      <Avatar hue={post.author.avatarHue} label={post.author.name} src={post.author.imageUrl ?? undefined} size={42} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className="truncate font-semibold">{post.author.name}</span>
          <span className="truncate text-grey">{post.author.handle}</span>
          <Link href={`/feed/${post.id}`} className="ml-auto shrink-0 text-xs text-grey hover:text-accent">{relativeTime(post.createdAt)}</Link>
        </div>
        {post.body && <FeedBody body={post.body} characters={characters} />}
      </div>
    </div>

    {post.sharedPost && <div className="ml-12"><SharedPostCard characters={characters} post={post.sharedPost} /></div>}
    {post.mediaKind && post.mediaUrl && <div className="ml-12 mt-3 overflow-hidden rounded-lg border border-line"><FeedMedia kind={post.mediaKind} url={post.mediaUrl} body={post.body} characters={characters} /></div>}
    {productionSummary && (
      <div className="ml-12 mt-3">
        <ProductionFeedPoster
          summary={productionSummary}
          cast={productionCast}
          href={linkedProduction ? `/productions/${linkedProduction.id}` : undefined}
          productImageUrl={linkedProduction?.productImageUrl}
        />
      </div>
    )}

    <div className="ml-12 mt-4 grid grid-cols-4 gap-1 text-[11px] text-grey">
      <button type="button" onClick={() => setReplying((value) => !value)} className="rounded-full py-2 hover:bg-white/5 hover:text-accent">↩ {post.replyCount || "Reply"}</button>
      <button type="button" disabled={busy} onClick={() => action("/api/feed/reactions", { postId: post.id, userId: currentUserId })} className={`rounded-full py-2 hover:bg-white/5 ${post.viewerHasLiked ? "text-accent" : "hover:text-accent"}`}>♥ {post.reactionCount || "Like"}</button>
      <button type="button" disabled={busy} onClick={() => action("/api/feed", { authorId: currentUserId, sharedPostId: post.id })} className="rounded-full py-2 hover:bg-white/5 hover:text-accent">⇄ {post.shareCount || "Repost"}</button>
      <button type="button" onClick={copyShare} className="rounded-full py-2 hover:bg-white/5 hover:text-accent">↗ Share</button>
    </div>

    {(replying || expanded) && <div className="ml-12 mt-3 border-t border-line pt-3">
      {topReplies.map((reply) => <div key={reply.id}><ReplyRow reply={reply} onReply={(value) => { setParentReply(value); setReplying(true); }} />{(children.get(reply.id) ?? []).map((child) => <ReplyRow key={child.id} reply={child} onReply={(value) => { setParentReply(value); setReplying(true); }} />)}</div>)}
      <div className="mt-2 flex gap-2">
        <textarea value={replyBody} onChange={(event) => setReplyBody(event.target.value)} rows={2} placeholder={parentReply ? `Reply to ${parentReply.author.name}` : `Reply to ${post.author.name}`} className="min-w-0 flex-1 resize-none rounded-md border border-line bg-paper-dim px-3 py-2 text-sm focus:border-accent focus:outline-none" />
        <button type="button" disabled={busy || !replyBody.trim()} onClick={sendReply} className="self-end rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">Post</button>
      </div>
    </div>}
  </article>;
}

export default function CreatorFeed({ postId }: { postId?: string }) {
  const currentUserId = useChaplinStore((state) => state.currentUserId);
  const currentUser = useChaplinStore((state) => state.users.find((user) => user.id === state.currentUserId));
  const characters = useChaplinStore((state) => state.characters);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [body, setBody] = useState("");
  const [mediaKind, setMediaKind] = useState<FeedMediaKind>("image");
  const [mediaUrl, setMediaUrl] = useState("");
  const [showMedia, setShowMedia] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authIdentity, setAuthIdentity] = useState<{ id: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedLive, setFeedLive] = useState(false);
  const [tab, setTab] = useState<FeedTabId>("for-you");

  useEffect(() => {
    let cancelled = false;
    void getClientAuthIdentity()
      .then((identity) => {
        if (!cancelled) {
          setAuthIdentity(identity);
          setAuthReady(true);
        }
      })
      .catch(() => { if (!cancelled) setAuthReady(true); });
    return () => { cancelled = true; };
  }, []);

  const load = useCallback(async () => {
    const query = new URLSearchParams({ viewerId: currentUserId });
    if (postId) query.set("postId", postId);
    const response = await fetch(`/api/feed?${query}`, { cache: "no-store" });
    const data = await response.json() as { posts?: FeedPost[]; error?: string };
    if (!response.ok) throw new Error(data.error || "Could not load the feed.");
    setPosts(data.posts ?? []);
    setFeedLive(true);
  }, [currentUserId, postId]);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      void load().catch((loadError: unknown) => {
        if (active) {
          setFeedLive(false);
          setError(loadError instanceof Error ? loadError.message : "Could not load the feed.");
        }
      });
    };
    refresh();
    const interval = window.setInterval(refresh, 8000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [load]);

  async function publish() {
    if (!body.trim() && !mediaUrl.trim()) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/feed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ authorId: currentUserId, body, mediaKind: mediaUrl.trim() ? mediaKind : undefined, mediaUrl: mediaUrl.trim() || undefined }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not publish the post.");
      setBody(""); setMediaUrl(""); setShowMedia(false);
      await load();
    } catch (publishError) { setError(publishError instanceof Error ? publishError.message : "Could not publish the post."); }
    finally { setBusy(false); }
  }

  const title = useMemo(() => postId ? "Thread" : "Feed", [postId]);
  const visiblePosts = useMemo(
    () => (postId ? posts : applyFeedTab(posts, tab, currentUserId)),
    [posts, tab, currentUserId, postId],
  );
  const tags = useMemo(() => trendingTags(posts), [posts]);
  const topActors = useMemo(
    () => [...characters].sort((left, right) => right.stats.fans - left.stats.fans).slice(0, 5),
    [characters],
  );

  return <main className="mx-auto grid w-full max-w-5xl gap-10 sm:px-5 sm:py-8 lg:grid-cols-[minmax(0,42rem)_17rem]">
    <div className="min-w-0">
      <header className="border-b border-line px-4 pt-5 sm:px-0 sm:pt-0">
        {postId && <Link href="/feed" className="text-xs text-grey hover:text-accent">← Feed</Link>}
        <div className="mt-1 flex items-end justify-between gap-3 pb-4">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">
              Chaplin creators
              {!postId && (
                <span className={`flex items-center gap-1 text-[8px] tracking-[0.12em] ${feedLive ? "text-emerald-400" : "text-grey"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${feedLive ? "animate-pulse bg-emerald-400" : "bg-grey"}`} />
                  Live
                </span>
              )}
            </p>
            <h1 className="reel-title text-3xl">{title}</h1>
          </div>
          {!postId && <Link href="/create" className="hidden rounded-full border border-line px-4 py-2 text-xs hover:border-accent sm:inline-flex">Write</Link>}
        </div>
        {!postId && (
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0" role="tablist" aria-label="Feed filters">
            {FEED_TABS.map((entry) => {
              const active = entry.id === tab;
              return (
                <button
                  key={entry.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(entry.id)}
                  className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[11px] font-semibold transition-colors ${
                    active
                      ? "border-accent bg-accent text-paper"
                      : "border-line text-grey hover:border-accent/50 hover:text-ink"
                  }`}
                >
                  {entry.label}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {!postId && authReady && authIdentity && <section data-feed-composer className="border-b border-line bg-paper px-4 py-5 sm:px-0">
        <div className="flex gap-3">
          {currentUser && <Avatar hue={currentUser.avatarHue} label={currentUser.name} src={currentUser.imageUrl} size={42} />}
          <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={3} maxLength={2000} placeholder="Share a scene, a question, a first cut, or what you learned…" className="min-w-0 flex-1 resize-none bg-transparent text-base leading-6 outline-none placeholder:text-grey" />
        </div>
        {showMedia && <div className="ml-12 mt-3 flex gap-2"><select value={mediaKind === "audio" ? "image" : mediaKind} onChange={(event) => setMediaKind(event.target.value as FeedMediaKind)} className="rounded-md border border-line bg-paper-dim px-2 text-xs"><option value="image">Image</option><option value="video">Video</option></select><input value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} placeholder="Paste one image or video URL" className="min-w-0 flex-1 rounded-md border border-line bg-paper-dim px-3 py-2 text-xs focus:border-accent focus:outline-none" /></div>}
        <div className="ml-12 mt-3 flex items-center justify-between gap-3 border-t border-line pt-3"><button type="button" onClick={() => setShowMedia((value) => !value)} className="text-xs text-accent">{showMedia ? "Remove attachment" : "+ Add media"}</button><button type="button" disabled={busy || (!body.trim() && !mediaUrl.trim())} onClick={publish} className="rounded-full bg-accent px-5 py-2 text-xs font-semibold text-white disabled:opacity-40">{busy ? "Posting…" : "Post"}</button></div>
      </section>}
      {!postId && authReady && !authIdentity && <section className="border-b border-line px-4 py-6 sm:px-0">
        <p className="reel-title text-xl">Join the conversation.</p>
        <p className="mt-1 text-sm text-grey">Sign in as a Creator to post, reply, like, and repost.</p>
        <Link href="/auth" className="mt-4 inline-block rounded-full bg-accent px-5 py-2.5 text-xs font-semibold text-white">Sign in or create account</Link>
      </section>}

      {error && <p className="m-4 rounded-md border border-accent/40 bg-accent/10 p-3 text-sm sm:mx-0">{error}</p>}
      <div>{visiblePosts.map((post) => <PostCard key={post.id} post={post} currentUserId={currentUserId} refresh={load} expanded={Boolean(postId)} />)}{!error && visiblePosts.length === 0 && <div className="border-b border-line p-10 text-center"><p className="reel-title text-xl">{EMPTY_TAB_COPY[postId ? "for-you" : tab]}</p></div>}</div>
    </div>

    {!postId && <aside className="hidden lg:block">
      <div className="sticky top-20 space-y-6">
        {topActors.length > 0 && (
          <section className="rounded-xl border border-line bg-white/[0.035] p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">Top performers</p>
              <Link href="/characters" className="text-[10px] text-grey hover:text-accent">View all ›</Link>
            </div>
            <ol className="grid gap-2">
              {topActors.map((character, index) => (
                <li key={character.id}>
                  <Link href={`/characters/${character.id}`} className="flex items-center gap-2.5 rounded-lg px-1 py-1.5 hover:bg-white/5">
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                      index === 0 ? "bg-amber-300/20 text-amber-300" : index === 1 ? "bg-white/12 text-white/70" : index === 2 ? "bg-orange-400/15 text-orange-300" : "text-grey"
                    }`}>{index + 1}</span>
                    <Avatar hue={character.avatarHue} label={character.name} src={character.imageUrl} size={28} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-semibold text-ink">{character.name}</span>
                      <span className="block truncate text-[10px] text-grey">{ARCHETYPE_LABEL[character.archetype]}</span>
                    </span>
                    <span className="shrink-0 text-right text-[10px] text-grey">{compactNumber(character.stats.fans)}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        )}

        {tags.length > 0 && (
          <section className="rounded-xl border border-line bg-white/[0.035] p-4">
            <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">Trending now</p>
            <ul className="grid gap-1.5">
              {tags.map((entry) => (
                <li key={entry.tag} className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[12px] font-medium text-accent-secondary">{entry.tag}</span>
                  <span className="shrink-0 text-[10px] text-grey">{entry.count} {entry.count === 1 ? "post" : "posts"}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-xl border border-line bg-white/[0.035] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Publish on Chaplin</p>
          <h2 className="reel-title mt-3 text-2xl leading-tight">Build an audience around the work.</h2>
          <p className="mt-3 text-sm leading-6 text-grey">Share scenes, production notes, pilots, and the process behind your characters.</p>
          <Link href="/create" className="mt-5 block rounded-full bg-accent px-4 py-2.5 text-center text-xs font-semibold text-white">Start creating</Link>
        </section>
      </div>
    </aside>}
  </main>;
}
