#!/usr/bin/env npx tsx
/**
 * Ensures every overlay uses the shared safe-area system.
 * Manual QA: features/releases/checklists/OVERLAY-MODAL-QA.md
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
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

function mustNotInclude(file: string, needle: string, label: string) {
  if (read(file).includes(needle)) {
    throw new Error(`${label}: must not include "${needle}" in ${file}`);
  }
}

const BOTTOM_SHELL_FILES = [
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

const CENTER_SHELL_FILES = [
  "components/TrainingMatchModal.tsx",
  "components/FrennixMatchExplainerModal.tsx",
  "components/CommentEditSheet.tsx",
  "components/whats-new/WhatsNewLaunchPrompt.tsx",
];

function walkTsx(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === "dist") continue;
      walkTsx(full, acc);
      continue;
    }
    if (entry.endsWith(".tsx")) acc.push(full.slice(ROOT.length + 1));
  }
  return acc;
}

const checks = [
  {
    name: "docs:OVERLAY-SAFE-AREA.md",
    run: () => mustInclude("features/releases/OVERLAY-SAFE-AREA.md", "BottomOverlayShell", "doc"),
  },
  {
    name: "docs:BOTTOM-ACTION-SHEET-STANDARD.md",
    run: () => mustInclude("features/releases/BOTTOM-ACTION-SHEET-STANDARD.md", "BottomActionSheet", "doc"),
  },
  {
    name: "layout:no app-wide OverlaySafeAreaProvider",
    run: () => mustNotInclude("app/_layout.tsx", "OverlaySafeAreaProvider", "layout"),
  },
  {
    name: "hook:useBottomActionSheetLayout",
    run: () => {
      mustInclude("lib/use-bottom-action-sheet-layout.ts", "BOTTOM_SHEET_SAFETY_MARGIN_PX", "hook");
      mustInclude("lib/use-bottom-action-sheet-layout.ts", "visualViewport", "hook");
    },
  },
  {
    name: "shell:BottomActionSheet canonical",
    run: () => {
      mustInclude("components/BottomActionSheet.tsx", "useBottomActionSheetLayout", "shell");
      mustInclude("components/BottomActionSheet.tsx", "restoreWebDocumentScrollLock", "shell");
      mustInclude("components/PostInteractionSheet.tsx", "BottomActionSheet", "post sheet");
    },
  },
  {
    name: "shell:BottomOverlayShell + center overlay hook",
    run: () => {
      mustInclude("components/BottomOverlayShell.tsx", "BottomOverlayShell", "shell");
      mustInclude("components/BottomOverlayShell.tsx", "useCenterOverlaySafeArea", "shell");
    },
  },
  {
    name: "ui:legacy bottom sheets use BottomOverlayShell",
    run: () => {
      for (const file of BOTTOM_SHELL_FILES) {
        mustInclude(file, "BottomOverlayShell", file);
        mustNotInclude(file, 'justifyContent: "flex-end"', file);
      }
    },
  },
  {
    name: "ui:center modals use useCenterOverlaySafeArea",
    run: () => {
      for (const file of CENTER_SHELL_FILES) {
        mustInclude(file, "useCenterOverlaySafeArea", file);
      }
    },
  },
  {
    name: "ui:ImageLightbox uses safe area insets",
    run: () => {
      mustInclude("components/ImageLightbox.tsx", "useSafeAreaInsets", "lightbox");
    },
  },
  {
    name: "audit:no orphan Modal flex-end backdrops",
    run: () => {
      const modalFiles = walkTsx(join(ROOT, "components")).filter((f) => read(f).includes("<Modal"));
      const allowedCustom = new Set([
        ...BOTTOM_SHELL_FILES,
        ...CENTER_SHELL_FILES,
        "components/BottomOverlayShell.tsx",
        "components/BottomActionSheet.tsx",
        "components/PostInteractionSheet.tsx",
        "components/ImageLightbox.tsx",
        "components/WorkoutStoryViewer.tsx",
        "components/founder/FounderSidebar.tsx",
        "components/story/StoryAnalyticsModal.tsx",
      ]);
      const offenders: string[] = [];
      for (const file of modalFiles) {
        if (allowedCustom.has(file)) continue;
        const src = read(file);
        if (src.includes('justifyContent: "flex-end"') || src.includes("justifyContent: 'flex-end'")) {
          offenders.push(file);
        }
      }
      if (offenders.length) {
        throw new Error(`Modal files with custom flex-end backdrop: ${offenders.join(", ")}`);
      }
    },
  },
  {
    name: "process:RELEASE_PROCESS overlay rule",
    run: () => mustInclude("features/releases/RELEASE_PROCESS.md", "OVERLAY-SAFE-AREA", "process"),
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
