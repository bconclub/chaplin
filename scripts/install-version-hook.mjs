import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

try {
  execFileSync("git", ["config", "core.hooksPath", ".githooks"], {
    cwd: root,
    stdio: "ignore",
  });
  process.stdout.write("Chaplin version hook installed.\n");
} catch {
  process.stderr.write("Chaplin version hook could not be installed. Run npm run version:install-hooks inside the repository.\n");
  process.exitCode = 1;
}
