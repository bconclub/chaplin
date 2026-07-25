import type { Metadata } from "next";
import CreatorFeed from "@/components/CreatorFeed";
import { buildFeedShareCopy } from "@/lib/feed-share";
import { listFeedPosts } from "@/lib/server/feed";
import { listCharacters } from "@/lib/server/supabase-admin";

function appOrigin() {
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ?? process.env.VERCEL_URL;
  if (vercelHost) return `https://${vercelHost.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return "https://chaplin-gamma.vercel.app";
}

function absoluteMediaUrl(value: string | null, origin: string) {
  if (!value) return null;
  try {
    return new URL(value, origin).toString();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const origin = appOrigin();
  const canonicalUrl = `${origin}/feed/${encodeURIComponent(id)}`;

  try {
    const posts = await listFeedPosts({ postId: id, limit: 1 });
    const post = posts[0];
    if (!post) throw new Error("Post not found.");

    let characterNames: string[] = [];
    try {
      characterNames = (await listCharacters()).map((character) => character.name);
    } catch {
      // The post body still provides a useful fallback when catalogue lookup is unavailable.
    }

    const shareCopy = buildFeedShareCopy(post, characterNames);
    const mediaUrl = absoluteMediaUrl(post.mediaUrl, origin);
    const image = post.mediaKind === "image" ? mediaUrl : null;
    const video = post.mediaKind === "video" ? mediaUrl : null;

    return {
      title: shareCopy.title,
      description: shareCopy.description,
      alternates: { canonical: canonicalUrl },
      openGraph: {
        type: "article",
        siteName: "Chaplin",
        url: canonicalUrl,
        title: shareCopy.title,
        description: shareCopy.description,
        images: image ? [{ url: image, alt: shareCopy.title }] : undefined,
        videos: video ? [{ url: video }] : undefined,
      },
      twitter: {
        card: "summary_large_image",
        title: shareCopy.title,
        description: shareCopy.description,
        images: image ? [image] : undefined,
      },
    };
  } catch {
    return {
      title: "See what I’m creating on Chaplin",
      description: "A new character is taking shape. The actor is artificial. The ambition isn’t.",
      alternates: { canonical: canonicalUrl },
      openGraph: {
        type: "website",
        siteName: "Chaplin",
        url: canonicalUrl,
        title: "See what I’m creating on Chaplin",
        description: "A new character is taking shape. The actor is artificial. The ambition isn’t.",
      },
    };
  }
}

export default async function FeedThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CreatorFeed postId={id} />;
}
