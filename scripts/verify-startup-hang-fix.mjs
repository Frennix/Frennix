/**
 * Verify startup hang fix wiring.
 * Usage: node scripts/verify-startup-hang-fix.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function mustInclude(file, ...needles) {
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) throw new Error(`Missing file: ${file}`);
  const text = fs.readFileSync(abs, "utf8");
  for (const needle of needles) {
    if (!text.includes(needle)) {
      throw new Error(`${file} must include: ${needle}`);
    }
  }
}

function main() {
  mustInclude("lib/async-timeout.ts", "withTimeout", "AsyncTimeoutError");
  mustInclude("lib/startup-diagnostics.ts", "reportStartupStall", "trackStartupStall");
  mustInclude(
    "providers/AuthProvider.tsx",
    "AUTH_FORCE_READY_MS = 10_000",
    "withTimeout",
    "authBootstrapTimedOut",
    "reportStartupStall"
  );
  mustInclude(
    "app/index.tsx",
    "AUTH_BOOTSTRAP_TIMEOUT_MS = 10_000",
    "reportStartupStall",
    "describeAuthBootstrapPhase"
  );
  mustInclude("components/StartupWatchdog.tsx", "STARTUP_STALL_MS = 10_000", "reportStartupStall");
  mustInclude(
    "lib/startup-mount-trace.ts",
    "describeAuthBootstrapPhase",
    "effects have not run yet"
  );
  mustInclude("components/StartupRetryScreen.tsx", "showMountTrace");

  console.log("verify-startup-hang-fix: PASS");
}

main();
