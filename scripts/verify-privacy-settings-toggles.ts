/**
 * Privacy & Discovery toggle UX — layout, per-switch saving, web switch CSS.
 * Run: npm run verify:privacy-settings-toggles
 */

function assertIncludes(haystack: string, needle: string, label: string) {
  if (!haystack.includes(needle)) {
    throw new Error(`${label}: expected source to include "${needle}"`);
  }
}

function assertExcludes(haystack: string, needle: string, label: string) {
  if (haystack.includes(needle)) {
    throw new Error(`${label}: expected source NOT to include "${needle}"`);
  }
}

function read(path: string): string {
  const fs = require("node:fs") as typeof import("node:fs");
  const nodePath = require("node:path") as typeof import("node:path");
  return fs.readFileSync(nodePath.join(__dirname, "..", path), "utf8");
}

function main() {
  const screen = read("app/privacy-settings.tsx");
  const css = read("lib/web-document-styles.js");

  assertIncludes(screen, "minWidth: 0", "row text wraps on narrow screens");
  assertIncludes(screen, "rowSwitchWrap", "switch wrapper prevents clipping");
  assertIncludes(screen, "flexShrink: 0", "switch keeps hit target on iphone");
  assertIncludes(screen, "minHeight: 44", "switch meets touch target size");
  assertIncludes(screen, "type PrivacyToggleKey", "per-toggle saving keys");
  assertIncludes(screen, "savingKey", "single active toggle save");
  assertExcludes(screen, "discoveryBusy", "no shared discovery busy gate");
  assertExcludes(screen, "discoveryMutation", "no shared discovery mutation");
  assertIncludes(screen, "profileFetchFailed", "profile fetch error surfaced");
  assertIncludes(screen, "showOnlineStatus", "online status toggle");
  assertIncludes(screen, 'runToggleSave("showOnlineStatus"', "online status independent save");

  assertIncludes(css, 'input:not([role="switch"])', "switch inputs excluded from auth input css");
  assertIncludes(css, 'input[role="switch"]', "switch touch styling");

  console.log("verify-privacy-settings-toggles: all checks passed");
}

main();
