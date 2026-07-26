export type VoiceLanguageContext = {
  characterBrief?: string;
  worldBrief?: string;
  personality?: string;
  tagline?: string;
  voiceDirection?: string;
};

const LEGACY_INDIAN_DEFAULTS = [
  /\bnative indian english with (?:natural|warm) hindi and urdu (?:pronunciation|inflection)\b/gi,
  /\bgrounded indian english,\s*clear hindi and urdu pronunciation\b/gi,
];

const EXPLICIT_INDIAN_CANON =
  /\b(india|indian|hindi|urdu|bengali|bangla|tamil|telugu|marathi|malayalam|kannada|punjabi|gujarati|assamese|odia)\b/i;

const LANGUAGE_DIRECTIONS: Array<{ match: RegExp; direction: string }> = [
  {
    match: /\b(russia|russian|moscow|saint petersburg|st\.? petersburg)\b/i,
    direction:
      "Primary spoken language: Russian with authentic native pronunciation. Use English only when the script or creator explicitly requests it; when used, retain a natural Russian accent.",
  },
  {
    match: /\b(ukraine|ukrainian|kyiv|odesa)\b/i,
    direction:
      "Primary spoken language: Ukrainian with authentic native pronunciation. Use English only when the script or creator explicitly requests it; when used, retain a natural Ukrainian accent.",
  },
  {
    match: /\b(france|french|parisian|québécois|quebecois)\b/i,
    direction:
      "Primary spoken language: French in the stated regional dialect. Use English only when the script or creator explicitly requests it; when used, retain that character-specific French accent.",
  },
  {
    match: /\b(spain|spanish|castilian|mexican|argentinian|colombian|latin american spanish)\b/i,
    direction:
      "Primary spoken language: Spanish in the character's stated regional dialect. Use English only when the script or creator explicitly requests it; do not flatten the dialect into a generic accent.",
  },
  {
    match: /\b(brazil|brazilian|portuguese|portugal)\b/i,
    direction:
      "Primary spoken language: Portuguese in the character's stated regional dialect. Use English only when the script or creator explicitly requests it; preserve the regional accent.",
  },
  {
    match: /\b(japan|japanese|tokyo|osaka|kansai)\b/i,
    direction:
      "Primary spoken language: Japanese in the stated regional register. Use English only when the script or creator explicitly requests it; preserve natural Japanese pronunciation.",
  },
  {
    match: /\b(korea|korean|seoul|busan)\b/i,
    direction:
      "Primary spoken language: Korean in the stated regional register. Use English only when the script or creator explicitly requests it; preserve natural Korean pronunciation.",
  },
  {
    match: /\b(mandarin|cantonese|china|chinese|beijing|shanghai|hong kong)\b/i,
    direction:
      "Primary spoken language: the Chinese language or dialect named in the character canon. Use English only when the script or creator explicitly requests it; never substitute one Chinese dialect for another.",
  },
  {
    match: /\b(arabic|egyptian|levantine|gulf arabic|moroccan|lebanese|syrian|iraqi|saudi)\b/i,
    direction:
      "Primary spoken language: Arabic in the character's stated regional dialect. Use English only when the script or creator explicitly requests it; preserve the regional pronunciation.",
  },
  {
    match: /\b(germany|german|austrian|swiss german)\b/i,
    direction:
      "Primary spoken language: German in the stated regional dialect. Use English only when the script or creator explicitly requests it; retain that character-specific accent.",
  },
  {
    match: /\b(italy|italian|roman|sicilian|neapolitan)\b/i,
    direction:
      "Primary spoken language: Italian in the stated regional dialect. Use English only when the script or creator explicitly requests it; retain that character-specific accent.",
  },
  {
    match: /\b(british english|english accent|received pronunciation|cockney|scottish|welsh|irish)\b/i,
    direction:
      "Primary spoken language: English in the regional dialect named in the character canon. Preserve its pronunciation without exaggerating it.",
  },
  {
    match: /\b(american english|american accent|united states|southern drawl|new york accent)\b/i,
    direction:
      "Primary spoken language: American English in the character's stated regional dialect. Preserve the regional pronunciation without exaggerating it.",
  },
  {
    match: EXPLICIT_INDIAN_CANON,
    direction:
      "Primary spoken language and dialect: follow the specific Indian language, Indian-English accent, and code-switching named in the character canon. Do not add Hindi, Urdu, or English unless the canon or script calls for it.",
  },
];

function canonText(context: VoiceLanguageContext) {
  return [
    context.characterBrief,
    context.worldBrief,
    context.personality,
    context.tagline,
  ].filter(Boolean).join(" ");
}

export function isLegacyIndianVoiceDefault(value: string) {
  return LEGACY_INDIAN_DEFAULTS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(value);
  });
}

export function sanitizeVoicePerformanceDirection(context: VoiceLanguageContext) {
  const raw = context.voiceDirection?.trim() ?? "";
  const canon = canonText(context);
  if (!raw || !isLegacyIndianVoiceDefault(raw) || EXPLICIT_INDIAN_CANON.test(canon)) {
    return raw;
  }

  let cleaned = raw;
  for (const pattern of LEGACY_INDIAN_DEFAULTS) {
    pattern.lastIndex = 0;
    cleaned = cleaned.replace(pattern, "");
  }
  return cleaned
    .replace(/^[\s,;:.–—-]+/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function resolveVoiceLanguageDirection(context: VoiceLanguageContext) {
  const performanceDirection = sanitizeVoicePerformanceDirection(context);
  const searchable = `${performanceDirection} ${canonText(context)}`.trim();
  for (const rule of LANGUAGE_DIRECTIONS) {
    if (rule.match.test(searchable)) return rule.direction;
  }
  return "Primary spoken language: follow the script when it names one; otherwise use neutral international English without inventing a regional accent or code-switching.";
}
