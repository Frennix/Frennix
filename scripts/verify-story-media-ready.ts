/**
 * Story media-ready viewer wiring checks.
 * Run: npx tsx scripts/verify-story-media-ready.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function read(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

function mustInclude(file: string, token: string, label: string) {
  if (!read(file).includes(token)) {
    throw new Error(`${label}: missing "${token}" in ${file}`);
  }
}

const checks: Array<{ name: string; run: () => void }> = [
  {
    name: "viewer tracks mediaReady and mediaFailed",
    run: () => {
      mustInclude("components/WorkoutStoryViewer.tsx", "mediaReady", "viewer");
      mustInclude("components/WorkoutStoryViewer.tsx", "mediaFailed", "viewer");
      mustInclude("components/WorkoutStoryViewer.tsx", "timerKey", "viewer");
    },
  },
  {
    name: "timer waits for media readiness",
    run: () => {
      const src = read("components/WorkoutStoryViewer.tsx");
      if (!src.includes("if (mediaFailed || !mediaReady)")) {
        throw new Error("Timer must stay stopped until media is ready");
      }
      if (!src.includes("STORY_MEDIA_LOAD_TIMEOUT_MS")) {
        throw new Error("Load timeout required");
      }
    },
  },
  {
    name: "ProgressiveImage onLoad/onError wired",
    run: () => {
      mustInclude("components/WorkoutStoryViewer.tsx", "onLoad={onMediaReady}", "image");
      mustInclude("components/WorkoutStoryViewer.tsx", "onError={onMediaError}", "image");
    },
  },
  {
    name: "FeedVideoPlayer readiness callback wired without feed autoplay rewrite",
    run: () => {
      mustInclude("packages/ui/src/FeedVideoPlayer.tsx", "onRenderedFrame", "video");
      mustInclude("packages/ui/src/FeedVideoPlayer.tsx", "shouldPlayOverride", "video");
      mustInclude("components/WorkoutStoryViewer.tsx", "onRenderedFrame={onMediaReady}", "video");
      const feed = read("packages/ui/src/FeedVideoPlayer.tsx");
      if (!feed.includes("inView &&") || !feed.includes("isActiveFeedVideo")) {
        throw new Error("Feed intersection autoplay must remain the default path");
      }
    },
  },
  {
    name: "Retry remounts current authorized media",
    run: () => {
      mustInclude("components/WorkoutStoryViewer.tsx", "retryCurrentMedia", "retry");
      mustInclude("components/WorkoutStoryViewer.tsx", 'title="Retry"', "retry");
      mustInclude("components/WorkoutStoryViewer.tsx", 'title="Close"', "retry");
      mustInclude("components/WorkoutStoryViewer.tsx", "setPlaybackEpoch", "retry");
    },
  },
  {
    name: "preload stays on authorized viewer slides",
    run: () => {
      mustInclude("lib/story-utils.ts", "prefetchAuthorizedViewerMedia", "preload");
      mustInclude("lib/story-media-ready.ts", "stories-private:", "preload");
      const src = read("lib/story-utils.ts");
      if (src.includes("getPublicUrl")) {
        throw new Error("Must not use getPublicUrl for story preload");
      }
    },
  },
];

let failed = 0;
for (const check of checks) {
  try {
    check.run();
    console.log(`ok  ${check.name}`);
  } catch (error) {
    failed += 1;
    console.error(`fail  ${check.name}: ${error instanceof Error ? error.message : error}`);
  }
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log(`\n${checks.length} story media-ready checks passed`);
}
