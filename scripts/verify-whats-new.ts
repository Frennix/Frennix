#!/usr/bin/env npx tsx
/**
 * Ensures in-app What's New release notes stay in sync with the current release.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

function read(path: string) {
  return readFileSync(join(ROOT, path), "utf8");
}

function mustInclude(file: string, needle: string, label: string) {
  if (!read(file).includes(needle)) {
    throw new Error(`${label}: missing "${needle}" in ${file}`);
  }
}

function loadWhatsNewFromSource() {
  const source = read("features/releases/whats-new.ts");
  const latestMatch = source.match(/WHATS_NEW_LATEST_VERSION\s*=\s*"([^"]+)"/);
  const latest = latestMatch?.[1];
  if (!latest) throw new Error("WHATS_NEW_LATEST_VERSION not found");

  const firstVersionMatch = source.match(/WHATS_NEW_RELEASES[\s\S]*?version:\s*"([^"]+)"/);
  const newest = firstVersionMatch?.[1];
  if (!newest) throw new Error("WHATS_NEW_RELEASES must include at least one version");

  const comingSoonCount = (source.match(/WHATS_NEW_COMING_SOON[\s\S]*?\]/m)?.[0].match(/"/g) ?? []).length;
  if (comingSoonCount < 2) throw new Error("WHATS_NEW_COMING_SOON must include roadmap highlights");

  return { latest, newest };
}

const checks: Array<{ name: string; run: () => void }> = [
  {
    name: "data:releases populated",
    run: () => {
      const source = read("features/releases/whats-new.ts");
      if (!source.includes("WHATS_NEW_RELEASES")) {
        throw new Error("WHATS_NEW_RELEASES missing");
      }
    },
  },
  {
    name: "data:latest version matches newest release",
    run: () => {
      const { latest, newest } = loadWhatsNewFromSource();
      if (latest !== newest) {
        throw new Error(`WHATS_NEW_LATEST_VERSION (${latest}) must match newest release (${newest})`);
      }
    },
  },
  {
    name: "data:coming soon populated",
    run: () => {
      loadWhatsNewFromSource();
    },
  },
  {
    name: "data:known issues populated",
    run: () => {
      const source = read("features/releases/whats-new.ts");
      if (!source.includes("WHATS_NEW_KNOWN_ISSUES")) {
        throw new Error("WHATS_NEW_KNOWN_ISSUES missing");
      }
      if (!source.includes("under_maintenance")) {
        throw new Error("WHATS_NEW_KNOWN_ISSUES must include status types");
      }
    },
  },
  {
    name: "ui:whats-new screen",
    run: () => {
      mustInclude("app/whats-new.tsx", "What&apos;s New", "screen");
      mustInclude("app/whats-new.tsx", "Coming Soon", "screen");
      mustInclude("app/whats-new.tsx", "WhatsNewKnownIssuesSection", "screen");
    },
  },
  {
    name: "nav:settings release notes link",
    run: () => {
      mustInclude("app/settings.tsx", "Release Notes", "settings");
      mustInclude("app/settings.tsx", "/whats-new", "settings");
    },
  },
  {
    name: "nav:profile whats new link",
    run: () => {
      mustInclude("components/ProfileScreenContent.tsx", "What&apos;s New", "profile");
      mustInclude("components/ProfileScreenContent.tsx", "/whats-new", "profile");
    },
  },
  {
    name: "ui:launch prompt after major update",
    run: () => {
      mustInclude("components/whats-new/WhatsNewLaunchPrompt.tsx", "View Release Notes", "prompt");
      mustInclude("app/(tabs)/_layout.tsx", "WhatsNewLaunchPrompt", "tabs");
      mustInclude("features/releases/whats-new.ts", "WHATS_NEW_LAUNCH_PROMPT_VERSION", "data");
    },
  },
  {
    name: "nav:stack route",
    run: () => {
      mustInclude("app/_layout.tsx", 'name="whats-new"', "layout");
    },
  },
  {
    name: "docs:WHATS-NEW guide",
    run: () => {
      mustInclude("features/releases/WHATS-NEW.md", "whats-new.ts", "docs");
    },
  },
];

let failed = 0;

for (const check of checks) {
  try {
    check.run();
    console.log(`PASS  ${check.name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL  ${check.name}`);
    console.error(`      ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failed > 0) {
  console.error(`\n${checks.length - failed}/${checks.length} PASS, ${failed} FAIL`);
  process.exit(1);
}

console.log(`\n${checks.length}/${checks.length} PASS`);
