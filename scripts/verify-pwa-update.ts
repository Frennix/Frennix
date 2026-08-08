/**
 * PWA auto-update verification — build SHA checks, single SW registration, shell cache.
 * Run: npm run verify:pwa-update
 */

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function assertIncludes(haystack: string, needle: string, label: string) {
  assert(haystack.includes(needle), `${label}: expected source to include "${needle}"`);
}

function assertExcludes(haystack: string, needle: string, label: string) {
  assert(!haystack.includes(needle), `${label}: expected source NOT to include "${needle}"`);
}

function read(path: string): string {
  const fs = require("node:fs") as typeof import("node:fs");
  const nodePath = require("node:path") as typeof import("node:path");
  return fs.readFileSync(nodePath.join(__dirname, "..", path), "utf8");
}

const PWA_SW_VERSION = "20260808-pwa-fetch-safe-v1";

function testServiceWorker() {
  const sw = read("public/sw.js");
  assertIncludes(sw, `FRENNIX_SW_VERSION = "${PWA_SW_VERSION}"`, "sw version");
  assertIncludes(sw, "frennix-shell-v11", "shell cache version");
  assertIncludes(sw, 'SHELL_ASSETS = ["/manifest.webmanifest"]', "shell precache scope");
  assert(!sw.includes('"/", "/manifest'), "shell precache excludes root html");
  assertIncludes(sw, 'cache: "no-store"', "navigate network-only");
  assertIncludes(sw, "SKIP_WAITING", "skip waiting message");
  assertIncludes(sw, "shouldHandleFetch", "fetch protocol guard");
  assertIncludes(sw, "safeRespond", "respondWith error guard");
  assertIncludes(sw, "offlineHtmlResponse", "offline html fallback");
}

function testRegisterModule() {
  const register = read("lib/register-pwa-service-worker.ts");
  assertIncludes(register, `PWA_SW_VERSION = "${PWA_SW_VERSION}"`, "register sw version sync");
  assertIncludes(register, 'register(SW_PATH, { scope: "/", updateViaCache: "none" })', "single sw register");
  assertIncludes(register, "runPwaUpdateCheck", "run pwa update check");
  assertIncludes(register, "controllerchange", "controller reload hook");
  assertIncludes(register, "checkForDeployedBuildUpdate", "build sha check");
}

function testUpdateHelpers() {
  const update = read("lib/pwa-app-update.ts");
  assertIncludes(update, "fetchRemoteBuildSha", "remote build sha fetch");
  assertIncludes(update, "checkForDeployedBuildUpdate", "build update compare");
  assertIncludes(update, "reloadForPwaUpdate", "reload helper");
  assertIncludes(update, "frennix:pwa-update-reload", "reload session guard");
}

function testBootstrapAndPrompt() {
  const bootstrap = read("components/PwaBootstrap.tsx");
  assertIncludes(bootstrap, "runPwaUpdateCheck", "bootstrap update check");
  assertIncludes(bootstrap, "PwaUpdatePrompt", "update prompt mount");

  const prompt = read("components/PwaUpdatePrompt.tsx");
  assertIncludes(prompt, "Update available", "update prompt copy");
  assertIncludes(prompt, "Reload", "update prompt action");
}

function testPatchPipeline() {
  const patch = read("scripts/patch-web-html.js");
  assertIncludes(patch, `SW_VERSION = "${PWA_SW_VERSION}"`, "patch sw version");
  assertIncludes(patch, "frennix-pwa-early-update", "early update script");
  assertIncludes(patch, "frennix-build-stamp", "build stamp");
  assertIncludes(patch, "frennix_build_check", "build check query param");
  assertExcludes(patch, 'register("/sw.js")', "no duplicate inline sw register");
}

function testPhase2Compat() {
  const phase2 = read("scripts/verify-notification-engine-phase2.ts");
  assertIncludes(phase2, "frennix-shell-v11", "phase2 shell cache expectation");
  assertIncludes(phase2, "frennix-pwa-early-update", "phase2 early update expectation");
}

function main() {
  testServiceWorker();
  testRegisterModule();
  testUpdateHelpers();
  testBootstrapAndPrompt();
  testPatchPipeline();
  testPhase2Compat();
  console.log("verify-pwa-update: all checks passed");
}

main();
