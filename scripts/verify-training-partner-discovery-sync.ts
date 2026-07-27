/**
 * Training partner discovery toggle sync verification.
 * Run: npm run verify:training-partner-discovery-sync
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
  const toggle = read("lib/training-partner-discovery-toggle.ts");
  const matchingSettings = read("app/matching-settings.tsx");
  const privacySettings = read("app/privacy-settings.tsx");

  assertIncludes(toggle, "matching_enabled ?? true", "default discovery on");
  assertIncludes(toggle, "setMatchingEnabledWithOptOut", "canonical db field update");

  assertIncludes(matchingSettings, "isTrainingPartnerDiscoveryEnabled", "matching settings reader");
  assertIncludes(matchingSettings, "setTrainingPartnerDiscoveryEnabled", "matching settings writer");
  assertExcludes(matchingSettings, "setMatchingEnabled(", "no legacy save-path setter");
  assertExcludes(matchingSettings, "setDiscoveryEnabled(", "no local-only discovery state");
  assertIncludes(matchingSettings, "flexShrink: 0", "switch not clipped on iphone");
  assertIncludes(matchingSettings, "minWidth: 0", "toggle text wraps on narrow screens");

  assertIncludes(privacySettings, "isTrainingPartnerDiscoveryEnabled", "privacy settings reader");
  assertIncludes(privacySettings, "setTrainingPartnerDiscoveryEnabled", "privacy settings writer");

  console.log("verify-training-partner-discovery-sync: all checks passed");
}

main();
