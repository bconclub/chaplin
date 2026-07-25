export const CHAPLIN_BRAND_AVATAR = "/brand/chaplin-mark.png";

export const CHAPLIN_USER_AVATARS = [
  CHAPLIN_BRAND_AVATAR,
  "/avatars/meera-caracal.webp",
  "/avatars/arjun-owl.webp",
  "/avatars/priya-fox.webp",
  "/avatars/kabir-raven.webp",
] as const;

const SEEDED_USER_AVATARS: Record<string, string> = {
  "u-admin": CHAPLIN_USER_AVATARS[0],
  "u-meera": CHAPLIN_USER_AVATARS[1],
  "u-arjun": CHAPLIN_USER_AVATARS[2],
  "u-priya": CHAPLIN_USER_AVATARS[3],
  "u-kabir": CHAPLIN_USER_AVATARS[4],
};

function stableAvatarIndex(value: string) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % CHAPLIN_USER_AVATARS.length;
}

export function userAvatarUrl(userId: string) {
  return SEEDED_USER_AVATARS[userId]
    ?? CHAPLIN_USER_AVATARS[stableAvatarIndex(userId)];
}
