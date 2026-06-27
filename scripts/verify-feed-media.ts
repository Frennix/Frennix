/**
 * Regression checks for feed media rendering (Safari web blank-rectangle fix).
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
    name: "Initial feed posts seed visiblePostIds before viewability fires",
    run: () => {
      const src = read("lib/useFeedInfiniteScroll.ts");
      if (!src.includes("seededInitialPostsRef")) {
        throw new Error("useFeedInfiniteScroll must seed initial visiblePostIds");
      }
      if (!src.includes("MEDIA_LOOKAHEAD_ITEMS")) {
        throw new Error("seed must cover first-screen posts");
      }
    },
  },
  {
    name: "FeedMediaSlot IntersectionObserver runs when parent visible=false",
    run: () => {
      const src = read("packages/ui/src/FeedMediaSlot.tsx");
      if (/active \|\| !visible/.test(src)) {
        throw new Error("FeedMediaSlot must not skip IntersectionObserver when visible=false");
      }
      if (!src.includes("IntersectionObserver")) {
        throw new Error("FeedMediaSlot must use IntersectionObserver on web");
      }
    },
  },
  {
    name: "MediaAspectFrame feed layout does not block on dimension probe",
    run: () => {
      const src = read("packages/ui/src/MediaAspectFrame.tsx");
      if (!src.includes("isFeed && layoutWidth > 0")) {
        throw new Error("MediaAspectFrame must treat laid-out feed frames as ready");
      }
    },
  },
  {
    name: "ProgressiveImage clears skeleton on load end",
    run: () => {
      const src = read("packages/ui/src/ProgressiveImage.tsx");
      if (!src.includes("onLoadEnd")) {
        throw new Error("ProgressiveImage must hide skeleton on onLoadEnd");
      }
    },
  },
  {
    name: "FeedPostCard mounts media through FeedMediaSlot",
    run: () => {
      const src = read("packages/ui/src/FeedPostCard.tsx");
      if (!src.includes("<FeedMediaSlot")) {
        throw new Error("FeedPostCard must render FeedMediaSlot for media");
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
console.log(`\nAll ${checks.length} feed media checks passed.`);
