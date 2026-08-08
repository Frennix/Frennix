/**
 * Phase 2 verification — PWA shell (manifest, service worker, components, build pipeline).
 * Run: npm run verify:notification-engine-phase2
 */

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function assertExcludes(haystack: string, needle: string, label: string) {
  if (haystack.includes(needle)) throw new Error(`${label}: expected source NOT to include "${needle}"`);
}

function assertIncludes(haystack: string, needle: string, label: string) {
  assert(haystack.includes(needle), `${label}: expected source to include "${needle}"`);
}

function read(path: string): string {
  const fs = require("node:fs") as typeof import("node:fs");
  const nodePath = require("node:path") as typeof import("node:path");
  return fs.readFileSync(nodePath.join(__dirname, "..", path), "utf8");
}

function testPublicAssets() {
  const manifest = read("public/manifest.webmanifest");
  assertIncludes(manifest, '"display": "standalone"', "manifest display mode");
  assertIncludes(manifest, "/icons/icon-192.png", "manifest icon 192");
  assertIncludes(manifest, "icon-512-maskable.png", "manifest maskable icon");

  const sw = read("public/sw.js");
  assertIncludes(sw, "skipWaiting", "sw install");
  assertIncludes(sw, "clients.claim", "sw activate");
  assertIncludes(sw, "frennix-shell-v11", "sw cache version");
  assertIncludes(sw, "FRENNIX_SW_VERSION", "sw version constant");
}

function testBuildPipeline() {
  const pkg = read("package.json");
  assertIncludes(pkg, "copy-pwa-assets.mjs", "build:web copy step");

  const patch = read("scripts/patch-web-html.js");
  assertIncludes(patch, "manifest.webmanifest", "patch manifest link");
  assertIncludes(patch, "apple-mobile-web-app-capable", "patch apple PWA meta");
  assertIncludes(patch, "frennix-pwa-early-update", "patch early pwa update");
  assertExcludes(patch, 'register("/sw.js")', "patch no duplicate sw register");

  const copyScript = read("scripts/copy-pwa-assets.mjs");
  assertIncludes(copyScript, "public", "copy script public dir");
  assertIncludes(copyScript, "icon-192.png", "copy script icons");
}

function testPwaModules() {
  const pwa = read("lib/pwa.ts");
  assertIncludes(pwa, "isWebStandalone", "pwa standalone detect");
  assertIncludes(pwa, "shouldShowPwaInstallGuideForWeb", "pwa ios guide gate");
  assertIncludes(pwa, "WEB_PUSH_ENABLED = false", "push disabled Phase 2");

  const register = read("lib/register-pwa-service-worker.ts");
  assertIncludes(register, "/sw.js", "register sw path");
  assertIncludes(register, "ensurePwaServiceWorkerReady", "sw ensure helper");
  assertIncludes(register, "PWA_SW_VERSION", "sw version export");
}

function testComponents() {
  const iosGuide = read("components/IosPwaInstallGuide.tsx");
  assertIncludes(iosGuide, "Add to Home Screen", "ios install guide");

  const webPush = read("components/WebPushOnboarding.tsx");
  assertIncludes(webPush, "subscribeToWebPush", "web push subscribe");

  const bootstrap = read("components/PwaBootstrap.tsx");
  assertIncludes(bootstrap, "runPwaUpdateCheck", "pwa bootstrap update check");

  const layout = read("app/_layout.tsx");
  assertIncludes(layout, "PwaBootstrap", "layout pwa bootstrap");

  const settings = read("app/notification-settings.tsx");
  assertIncludes(settings, "IosPwaInstallGuide", "settings ios guide");
  assertIncludes(settings, "WebPushOnboarding", "settings web push ui");

  const html = read("app/+html.tsx");
  assertIncludes(html, "manifest.webmanifest", "dev html manifest");
}

function main() {
  testPublicAssets();
  testBuildPipeline();
  testPwaModules();
  testComponents();
  console.log("verify-notification-engine-phase2: all checks passed");
}

main();
