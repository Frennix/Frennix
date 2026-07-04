#!/usr/bin/env npx tsx
/**
 * Static checks for overlay safe-area handling (permanent design rule).
 * Manual QA required: features/releases/checklists/OVERLAY-MODAL-QA.md
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

const BOTTOM_SHELL_COMPONENTS = [
  "components/EntityActionSheet.tsx",
  "components/ReportReasonSheet.tsx",
  "components/EntityListSheet.tsx",
  "components/ContentModerationSheet.tsx",
  "components/SharePostSheet.tsx",
  "components/ShareChallengeSheet.tsx",
  "components/WorkoutSavedSheet.tsx",
  "components/TrainerFilterSheet.tsx",
  "components/story/StoryViewersModal.tsx",
  "components/story/StoryReactionsModal.tsx",
  "components/story/StoryQuestionAnswersModal.tsx",
];

const checks = [
  {
    name: "docs:OVERLAY-SAFE-AREA.md exists",
    run: () => mustInclude("features/releases/OVERLAY-SAFE-AREA.md", "OVERLAY_BOTTOM_SAFETY_MARGIN_PX", "doc"),
  },
  {
    name: "hook:useSheetSafeArea + safety margin",
    run: () => {
      mustInclude("lib/use-sheet-safe-area.ts", "OVERLAY_BOTTOM_SAFETY_MARGIN_PX", "hook");
      mustInclude("lib/use-sheet-safe-area.ts", "env(safe-area-inset-bottom", "hook");
      mustInclude("lib/use-sheet-safe-area.ts", "visualViewport", "hook");
      mustInclude("lib/use-sheet-safe-area.ts", "requestAnimationFrame", "hook");
      mustInclude("lib/use-sheet-safe-area.ts", "webOverlayStyle", "hook");
      mustInclude("lib/use-sheet-safe-area.ts", "sheetMarginBottom", "hook");
    },
  },
  {
    name: "shell:BottomOverlayShell exists",
    run: () => {
      mustInclude("components/BottomOverlayShell.tsx", "useSheetSafeArea", "shell");
      mustInclude("components/BottomOverlayShell.tsx", "useCenterOverlaySafeArea", "shell");
    },
  },
  {
    name: "ui:PostInteractionSheet uses safe area hook",
    run: () => {
      mustInclude("components/PostInteractionSheet.tsx", "useSheetSafeArea", "post sheet");
      mustInclude("components/PostInteractionSheet.tsx", "sheetMarginBottom", "post sheet");
      mustInclude("components/PostInteractionSheet.tsx", "webOverlayStyle", "post sheet");
    },
  },
  {
    name: "ui:all standard bottom sheets use BottomOverlayShell",
    run: () => {
      for (const file of BOTTOM_SHELL_COMPONENTS) {
        mustInclude(file, "BottomOverlayShell", file);
      }
    },
  },
  {
    name: "ui:ReactionPicker safety margin in @frennix/ui",
    run: () => {
      mustInclude("../../packages/ui/src/theme.ts", "OVERLAY_BOTTOM_SAFETY_MARGIN_PX", "ui theme");
      mustInclude("../../packages/ui/src/ReactionPicker.tsx", "OVERLAY_BOTTOM_SAFETY_MARGIN_PX", "reaction picker");
    },
  },
  {
    name: "process:RELEASE_PROCESS overlay safe area rule",
    run: () => mustInclude("features/releases/RELEASE_PROCESS.md", "OVERLAY-SAFE-AREA", "release process"),
  },
];

let failed = 0;
for (const check of checks) {
  try {
    check.run();
    console.log(`PASS  ${check.name}`);
  } catch (e) {
    failed += 1;
    console.error(`FAIL  ${check.name}`);
    console.error(`      ${e instanceof Error ? e.message : String(e)}`);
  }
}

if (failed) {
  console.error(`\n${checks.length - failed}/${checks.length} PASS, ${failed} FAIL`);
  process.exit(1);
}
console.log(`\n${checks.length}/${checks.length} PASS`);
