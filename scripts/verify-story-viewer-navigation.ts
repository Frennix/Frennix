/**
 * Instagram-style story viewer navigation regression checks.
 * Run: npx tsx scripts/verify-story-viewer-navigation.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function read(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

const viewer = read("components/WorkoutStoryViewer.tsx");

const checks: Array<{ name: string; run: () => void }> = [
  {
    name: "Side tap zones use ~37.5% width with center hold zone",
    run: () => {
      if (!viewer.includes("TAP_ZONE_SIDE_RATIO")) {
        throw new Error("TAP_ZONE_SIDE_RATIO constant required");
      }
      if (!viewer.includes("tapZoneCenter")) {
        throw new Error("Center hold-only tap zone required");
      }
      if (!viewer.includes("tapZoneLeft") || !viewer.includes("tapZoneRight")) {
        throw new Error("Left/right tap zones required");
      }
    },
  },
  {
    name: "Left tap restarts first slide instead of jumping to previous user",
    run: () => {
      if (!viewer.includes("handleLeftTap")) throw new Error("handleLeftTap required");
      if (!viewer.includes("restartCurrentSlide")) throw new Error("restartCurrentSlide required");
      if (viewer.includes("goPrev")) {
        throw new Error("goPrev must be removed; left tap must not navigate to previous user");
      }
      if (!viewer.includes("restartCurrentSlide();")) {
        throw new Error("First slide left tap must call restartCurrentSlide");
      }
    },
  },
  {
    name: "Right tap advances via goNext",
    run: () => {
      if (!viewer.includes("tryNavigate(goNext)")) {
        throw new Error("Right tap must call goNext through tryNavigate");
      }
    },
  },
  {
    name: "Hold-to-pause wired on all tap zones",
    run: () => {
      if (!viewer.includes("beginHold") || !viewer.includes("endHold")) {
        throw new Error("Hold handlers required");
      }
      if (!viewer.includes("HOLD_THRESHOLD_MS")) {
        throw new Error("Hold threshold required to distinguish tap vs hold");
      }
      if (!viewer.includes("didHoldRef")) {
        throw new Error("Hold ref must block accidental navigation after pause");
      }
    },
  },
  {
    name: "Swipe-down dismiss via PanResponder",
    run: () => {
      if (!viewer.includes("PanResponder")) throw new Error("PanResponder required");
      if (!viewer.includes("gesture.dy > 120")) {
        throw new Error("Swipe-down dismiss threshold required");
      }
    },
  },
  {
    name: "Restart resets progress and media playback",
    run: () => {
      if (!viewer.includes("playbackEpoch")) throw new Error("playbackEpoch required");
      if (!viewer.includes("progress.setValue(0)")) {
        throw new Error("Progress bar must reset on restart");
      }
      if (!viewer.includes("key={`story-video-${playbackEpoch}`}")) {
        throw new Error("Video slide must remount on restart");
      }
    },
  },
  {
    name: "Navigation debounce prevents double-advance",
    run: () => {
      if (!viewer.includes("NAV_DEBOUNCE_MS") || !viewer.includes("tryNavigate")) {
        throw new Error("tryNavigate debounce required");
      }
    },
  },
  {
    name: "Footer controls sit above tap zones; reply focus pauses playback",
    run: () => {
      if (!viewer.includes("bottom: Math.max(400, footerBottomPad + 300)")) {
        throw new Error("Tap zones must exclude footer control area");
      }
      if (!/header:\s*\{[^}]*zIndex:\s*5/.test(viewer)) {
        throw new Error("Header must sit above the top fade and tap zones");
      }
      if (!/footer:\s*\{[^}]*zIndex:\s*30/.test(viewer)) {
        throw new Error("Footer must sit above the bottom fade and tap zones");
      }
      if (!/tapZones:\s*\{[^}]*zIndex:\s*3/.test(viewer)) {
        throw new Error("Tap zones must stay under the header and footer");
      }
      const fade = read("components/story/StoryFooterGradient.tsx");
      if (!viewer.includes("<StoryHeaderFade />") || !viewer.includes("<StoryFooterGradient />")) {
        throw new Error("Story viewer must use the short header and footer fades");
      }
      if (viewer.includes("scrimTop") || fade.includes("nativeBandStrong")) {
        throw new Error("Story viewer must not use a solid top bar or stacked fade bands");
      }
      if (!fade.includes('pointerEvents="none"')) {
        throw new Error("Story fades must not receive taps");
      }
      if (!viewer.includes("onFocusChange={setInteractionLocked}")) {
        throw new Error("Reply field focus must pause auto-advance");
      }
    },
  },
  {
    name: "Web tap zones disable text selection",
    run: () => {
      if (!viewer.includes("WebkitTouchCallout")) {
        throw new Error("Safari touch callout must be disabled on tap zones");
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
console.log(`\nAll ${checks.length} story viewer navigation checks passed.`);
