import type { FeedPost } from "@/lib/feed-types";

export type FeedTabId = "for-you" | "following" | "trending" | "new" | "microdramas" | "shorts" | "behind";

export const FEED_TABS: Array<{ id: FeedTabId; label: string }> = [
  { id: "for-you", label: "For you" },
  { id: "following", label: "Following" },
  { id: "trending", label: "Trending" },
  { id: "new", label: "New" },
  { id: "microdramas", label: "Microdramas" },
  { id: "shorts", label: "AI Shorts" },
  { id: "behind", label: "Behind the Scenes" },
];

function engagement(post: FeedPost) {
  return post.reactionCount * 3 + post.replyCount * 4 + post.shareCount * 5;
}

/** A post that announces a locked production, e.g. "Script locked: Curfew Tax". */
function isProduction(post: FeedPost) {
  return /^script locked:/i.test(post.body) || Boolean(post.seriesId) || Boolean(post.episodeId);
}

/**
 * Every tab filters on data the feed actually carries. There is no follow graph
 * in the product yet, so "Following" is derived from the viewer's own likes
 * rather than invented: it shows other posts by creators whose work the viewer
 * has already liked. When the viewer has liked nothing it says so instead of
 * silently falling back to the full feed.
 */
export function applyFeedTab(posts: FeedPost[], tab: FeedTabId, viewerId: string) {
  switch (tab) {
    case "trending":
      return [...posts].sort((left, right) => engagement(right) - engagement(left));
    case "new":
      return [...posts].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
    case "following": {
      const likedAuthors = new Set(
        posts.filter((post) => post.viewerHasLiked).map((post) => post.author.id),
      );
      return posts.filter((post) => likedAuthors.has(post.author.id) && post.author.id !== viewerId);
    }
    case "microdramas":
      return posts.filter(isProduction);
    case "shorts":
      return posts.filter((post) => post.mediaKind === "video");
    case "behind":
      return posts.filter((post) => !isProduction(post) && post.mediaKind !== "video");
    case "for-you":
    default:
      return posts;
  }
}

export const EMPTY_TAB_COPY: Record<FeedTabId, string> = {
  "for-you": "Nothing has been posted here yet.",
  following: "Like a post and the creators you follow will collect here.",
  trending: "Nothing has picked up engagement yet.",
  new: "Nothing has been posted here yet.",
  microdramas: "No locked productions have been shared yet.",
  shorts: "No video posts yet.",
  behind: "No process posts yet.",
};

/** Real hashtags taken from the posts on screen, most used first. */
export function trendingTags(posts: FeedPost[], limit = 6) {
  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const match of post.body.matchAll(/#(\w{2,30})/g)) {
      const tag = `#${match[1]}`;
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }));
}
