import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE_COMMIT = "064480d8b72e8a3b85ffdacb5894275af2c480e5";

function git(args) {
  return execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function formatVersion(ordinal) {
  const safeOrdinal = Math.max(0, Number(ordinal) || 0);
  const major = Math.floor(safeOrdinal / 10000);
  const minor = Math.floor((safeOrdinal % 10000) / 100);
  const patch = safeOrdinal % 100;
  return `${major}.${minor}.${patch}`;
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(ROOT, relativePath), "utf8"));
}

function writeJson(relativePath, value) {
  writeFileSync(
    join(ROOT, relativePath),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
}

function currentCommitCount() {
  return Number(git(["rev-list", "--count", "HEAD"]));
}

function committedOrdinal() {
  return Math.max(0, currentCommitCount() - 1);
}

function updatePackageVersion(relativePath, version) {
  const value = readJson(relativePath);
  value.version = version;
  writeJson(relativePath, value);
}

function updateLockVersion(relativePath, version) {
  const value = readJson(relativePath);
  value.version = version;
  if (value.packages?.[""]) value.packages[""].version = version;
  writeJson(relativePath, value);
}

function updateExpoVersion(version) {
  const value = readJson("mobile/app.json");
  value.expo.version = version;
  writeJson("mobile/app.json", value);
}

function historyRows(ref = "HEAD") {
  const raw = git(["log", ref, "--reverse", "--format=%H%x1f%h%x1f%cI%x1f%s"]);
  if (!raw) return [];
  return raw.split(/\r?\n/).map((line, ordinal) => {
    const [commit, shortCommit, date, subject] = line.split("\x1f");
    return {
      ordinal,
      version: formatVersion(ordinal),
      commit,
      shortCommit,
      date,
      subject,
    };
  });
}

function writeHistory(ref = "HEAD") {
  const rows = historyRows(ref);
  const lines = [
    "# Chaplin Version History",
    "",
    "The initial repository scaffold is `v0.0.0`. Every later commit advances",
    "Chaplin by one version ordinal. Patch and minor counters roll after 99.",
    "",
    "| Version | Commit | Date | Change |",
    "| --- | --- | --- | --- |",
    ...rows.map((row) =>
      `| v${row.version} | \`${row.shortCommit}\` | ${row.date} | ${row.subject.replaceAll("|", "\\|")} |`
    ),
    "",
  ];
  writeFileSync(join(ROOT, "docs", "VERSION_HISTORY.md"), lines.join("\n"), "utf8");
}

function syncVersion(ordinal, historyRef = "HEAD") {
  const version = formatVersion(ordinal);
  const sourceCommit = git(["rev-parse", "HEAD"]);
  const manifest = {
    schemaVersion: 1,
    product: "Chaplin",
    version,
    ordinal,
    baselineVersion: "0.0.0",
    baselineCommit: BASELINE_COMMIT,
    sourceCommit,
    generatedAt: new Date().toISOString(),
    rule: "Initial commit is 0.0.0. Every later commit increments the ordinal; patch and minor roll over every 100.",
  };

  writeJson("version.json", manifest);
  updatePackageVersion("package.json", version);
  updateLockVersion("package-lock.json", version);
  updatePackageVersion("mobile/package.json", version);
  updateLockVersion("mobile/package-lock.json", version);
  updateExpoVersion(version);
  writeHistory(historyRef);
  process.stdout.write(`Chaplin v${version} (change ${ordinal})\n`);
}

function checkVersion() {
  const expectedOrdinal = committedOrdinal();
  const expectedVersion = formatVersion(expectedOrdinal);
  const manifest = readJson("version.json");
  const files = [
    ["version.json", manifest.version],
    ["package.json", readJson("package.json").version],
    ["package-lock.json", readJson("package-lock.json").version],
    ["mobile/package.json", readJson("mobile/package.json").version],
    ["mobile/package-lock.json", readJson("mobile/package-lock.json").version],
    ["mobile/app.json", readJson("mobile/app.json").expo.version],
  ];
  const mismatches = files.filter(([, version]) => version !== expectedVersion);
  if (manifest.ordinal !== expectedOrdinal || mismatches.length) {
    const details = mismatches
      .map(([file, version]) => `${file}=${version}`)
      .join(", ");
    throw new Error(
      `Expected Chaplin v${expectedVersion} at commit ordinal ${expectedOrdinal}. ` +
      `Run "npm run version:prepare". ${details}`,
    );
  }
  process.stdout.write(`Chaplin v${expectedVersion} is synchronized.\n`);
}

const command = process.argv[2] || "current";

if (command === "prepare-commit") {
  syncVersion(currentCommitCount());
} else if (command === "sync-current") {
  // Updating an already-created commit requires an amend. Exclude that commit
  // from the generated ledger so the amend cannot leave a stale self-reference.
  syncVersion(committedOrdinal(), "HEAD^");
} else if (command === "history") {
  writeHistory();
} else if (command === "check") {
  checkVersion();
} else if (command === "current") {
  const manifest = readJson("version.json");
  process.stdout.write(`Chaplin v${manifest.version} (change ${manifest.ordinal})\n`);
} else {
  throw new Error(`Unknown version command: ${command}`);
}
