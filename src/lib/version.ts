import manifest from "../../version.json";

export const CHAPLIN_VERSION = manifest.version;
export const CHAPLIN_VERSION_ORDINAL = manifest.ordinal;
export const CHAPLIN_VERSION_LABEL = `v${CHAPLIN_VERSION}`;

export function chaplinBuildInfo() {
  const deploymentCommit =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    null;

  return {
    product: manifest.product,
    version: manifest.version,
    label: CHAPLIN_VERSION_LABEL,
    ordinal: manifest.ordinal,
    baselineVersion: manifest.baselineVersion,
    baselineCommit: manifest.baselineCommit,
    sourceCommit: manifest.sourceCommit,
    deploymentCommit,
    environment:
      process.env.VERCEL_ENV ||
      process.env.NODE_ENV ||
      "development",
    generatedAt: manifest.generatedAt,
    rule: manifest.rule,
  };
}
