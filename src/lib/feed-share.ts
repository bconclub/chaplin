type ShareablePost = {
  body: string;
  mediaKind: "image" | "video" | "audio" | null;
  author: {
    name: string;
  };
};

export type FeedShareCopy = {
  title: string;
  text: string;
  description: string;
  characterName: string | null;
};

const CHAPLIN_SIGN_OFF = "See what I created with Chaplin. The actor is artificial. The ambition isn’t.";

function cleanBody(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
function excerpt(value: string, max = 150) {
  const body = cleanBody(value);
  if (body.length <= max) return body;
  return `${body.slice(0, max - 1).trimEnd()}…`;
}

function escaped(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function characterFromBody(body: string, characterNames: string[]) {
  const normalizedBody = cleanBody(body);
  const exactMatch = [...characterNames]
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)
    .find((name) => new RegExp(`(^|\\W)${escaped(name)}(?=\\W|$)`, "iu").test(normalizedBody));
  if (exactMatch) return exactMatch;

  const inferred = normalizedBody.match(
    /\b(?:with|meet|introducing|for|of)\s+([\p{Lu}][\p{L}'’-]+(?:\s+[\p{Lu}][\p{L}'’-]+){0,2})/u,
  )?.[1];
  return inferred?.trim() || null;
}

export function buildFeedShareCopy(
  post: ShareablePost,
  characterNames: string[] = [],
): FeedShareCopy {
  const body = cleanBody(post.body);
  const bodyExcerpt = excerpt(body);
  const characterName = characterFromBody(body, characterNames);
  const isScene = /\b(scene|shot|frame|film|video|reel|episode)\b/i.test(body)
    || post.mediaKind === "video";
  const isSound = /\b(voice|dialogue|sound|sfx|theme|score)\b/i.test(body)
    || post.mediaKind === "audio";

  let title: string;
  let lead: string;

  if (isScene) {
    title = characterName
      ? `${characterName} has a new scene on Chaplin`
      : "A new scene is taking shape on Chaplin";
    lead = characterName
      ? `I’m building a new scene with ${characterName}. Here’s how it’s coming to life.`
      : "I’m building a new scene. Here’s how it’s coming to life.";
  } else if (isSound) {
    title = characterName
      ? `Hear ${characterName} come to life on Chaplin`
      : "A new character voice is coming to life on Chaplin";
    lead = characterName
      ? `I’m finding ${characterName}’s voice. This is what the character is becoming.`
      : "I’m finding this character’s voice. This is what they’re becoming.";
  } else {
    title = characterName
      ? `${characterName} is coming to life on Chaplin`
      : `See what ${post.author.name} is creating on Chaplin`;
    lead = characterName
      ? `I’m creating ${characterName}. This is what the character is becoming.`
      : "I’m creating a character. This is what they’re becoming.";
  }

  const text = [lead, bodyExcerpt, CHAPLIN_SIGN_OFF].filter(Boolean).join("\n\n");
  const description = [lead, bodyExcerpt, CHAPLIN_SIGN_OFF]
    .filter(Boolean)
    .join(" ")
    .slice(0, 300);

  return {
    title,
    text,
    description,
    characterName,
  };
}
