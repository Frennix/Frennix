/**
 * Regression checks for Workout Story viewer (Instagram-style, not post detail).
 * Run: pnpm verify:workout-stories
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function read(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

const checks: Array<{ name: string; run: () => void }> = [
  {
    name: "Dedicated WorkoutStoryViewer component exists",
    run: () => {
      const src = read("components/WorkoutStoryViewer.tsx");
      if (!src.includes("export function WorkoutStoryViewer")) {
        throw new Error("WorkoutStoryViewer must be exported");
      }
    },
  },
  {
    name: "Story viewer is full-screen modal, not page sheet post layout",
    run: () => {
      const src = read("components/WorkoutStoryViewer.tsx");
      if (src.includes('presentationStyle="pageSheet"')) {
        throw new Error("Story viewer must not use pageSheet presentation");
      }
      if (!src.includes("statusBarTranslucent")) {
        throw new Error("Story viewer must be full-screen");
      }
      if (src.includes("PostMediaCarousel")) {
        throw new Error("Story viewer must not reuse feed PostMediaCarousel");
      }
    },
  },
  {
    name: "Story viewer has progress bars and tap navigation",
    run: () => {
      const src = read("components/WorkoutStoryViewer.tsx");
      if (!src.includes("StoryProgressBars")) throw new Error("Progress bars required");
      if (!src.includes("tapZoneLeft") || !src.includes("tapZoneRight")) {
        throw new Error("Left/right tap zones required");
      }
      if (!src.includes("PanResponder")) throw new Error("Swipe-down dismiss required");
    },
  },
  {
    name: "Story viewer shows profile overlay without feed action buttons",
    run: () => {
      const src = read("components/WorkoutStoryViewer.tsx");
      if (!src.includes("<Avatar")) throw new Error("Profile avatar required in overlay");
      if (!src.includes("WorkoutTypeChips")) throw new Error("Workout type chips required");
      if (src.includes("Like") || src.includes("Comment") || src.includes("View post")) {
        throw new Error("Story viewer must not show feed/post action buttons");
      }
    },
  },
  {
    name: "Feed wires stories array into viewer without post detail navigation",
    run: () => {
      const feed = read("app/(tabs)/index.tsx");
      if (!feed.includes("stories={stories}")) {
        throw new Error("Feed must pass stories array to viewer");
      }
      if (!feed.includes("activeStoryIndex")) {
        throw new Error("Feed must track active story index");
      }
      if (feed.includes("onViewPost")) {
        throw new Error("Feed story flow must not navigate to post detail");
      }
    },
  },
  {
    name: "Caption renders as overlay not feed post body",
    run: () => {
      const src = read("components/WorkoutStoryViewer.tsx");
      if (!src.includes("captionOverlay")) {
        throw new Error("Caption must use overlay styling");
      }
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
    console.error(`FAIL  ${check.name}: ${error instanceof Error ? error.message : error}`);
  }
}

if (failed) process.exit(1);
console.log(`\nAll ${checks.length} workout story checks passed.`);
