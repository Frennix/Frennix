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
  {
    name: "PostMediaCarousel uses measured width for horizontal paging",
    run: () => {
      const src = read("packages/ui/src/PostMediaCarousel.tsx");
      if (!src.includes("containerWidth")) {
        throw new Error("PostMediaCarousel must measure container width in state");
      }
      if (!src.includes("getItemLayout")) {
        throw new Error("PostMediaCarousel must define getItemLayout for paging");
      }
      if (!src.includes("nestedScrollEnabled")) {
        throw new Error("PostMediaCarousel must enable nested horizontal scroll in feed");
      }
    },
  },
  {
    name: "Full-screen gallery uses contain fit without cropping",
    run: () => {
      const src = read("components/ImageLightbox.tsx");
      if (!src.includes('contentFit="contain"')) {
        throw new Error("ImageLightbox must use contentFit contain");
      }
      if (src.includes("contentFit=\"cover\"")) {
        throw new Error("ImageLightbox must not use cover in gallery");
      }
      if (!src.includes("stageWidth") || !src.includes("stageHeight")) {
        throw new Error("ImageLightbox must size images against measured stage bounds");
      }
      if (!src.includes("scrollEnabled={scrollEnabled}")) {
        throw new Error("ImageLightbox must disable gallery scroll while zoomed");
      }
      if (!src.includes("galleryCounter")) {
        throw new Error("ImageLightbox must show image counter in gallery");
      }
    },
  },
  {
    name: "Gallery restores feed carousel index on close",
    run: () => {
      const hook = read("lib/useImageLightbox.tsx");
      const carousel = read("packages/ui/src/PostMediaCarousel.tsx");
      if (!hook.includes("GalleryCloseHandler")) {
        throw new Error("useImageLightbox must accept gallery close callback with index");
      }
      if (!carousel.includes("pageIndex")) {
        throw new Error("PostMediaCarousel must accept controlled pageIndex");
      }
    },
  },
  {
    name: "Create post supports drag reorder for photo cover",
    run: () => {
      const src = read("app/create-post.tsx");
      if (!src.includes("ReorderablePhotoStrip")) {
        throw new Error("create-post must use ReorderablePhotoStrip");
      }
      if (!src.includes("reorderMedia")) {
        throw new Error("create-post must reorder selectedMedia before upload");
      }
    },
  },
  {
    name: "Single-image posts hide carousel dots and counter",
    run: () => {
      const src = read("packages/ui/src/PostMediaCarousel.tsx");
      if (!src.includes("mediaUrls.length === 1")) {
        throw new Error("PostMediaCarousel must short-circuit single-image posts");
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
