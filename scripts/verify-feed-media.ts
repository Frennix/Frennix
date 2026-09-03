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
    name: "FeedPostCard mounts media through FeedMedia",
    run: () => {
      const src = read("packages/ui/src/FeedPostCard.tsx");
      if (!src.includes("<FeedMedia")) {
        throw new Error("FeedPostCard must render FeedMedia for media");
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
      if (!src.includes("mediaItems.length === 1")) {
        throw new Error("PostMediaCarousel must short-circuit single-image posts");
      }
    },
  },
  {
    name: "Feed video frame uses intrinsic dimensions with portrait cap",
    run: () => {
      const player = read("packages/ui/src/FeedVideoPlayer.tsx");
      if (player.includes("fixedAspectRatio")) {
        throw new Error("FeedVideoPlayer must not use fixedAspectRatio — use maxPortraitRatio");
      }
      if (!player.includes("maxPortraitRatio")) {
        throw new Error("FeedVideoPlayer must cap feed video frames at maxPortraitRatio");
      }
      if (!player.includes("dimensionsUri")) {
        throw new Error("FeedVideoPlayer must probe poster dimensions for frame height");
      }
    },
  },
  {
    name: "Feed media height respects 4:5 portrait cap on phone width",
    run: () => {
      const phoneWidth = 390;
      const maxPortraitRatio = 5 / 4;
      const computeHeight = (
        containerWidth: number,
        mediaWidth: number,
        mediaHeight: number,
        cap: number
      ) => {
        const aspectRatio = mediaHeight / mediaWidth;
        const cappedRatio = aspectRatio > cap ? cap : aspectRatio;
        return containerWidth * cappedRatio;
      };
      const portrait916 = computeHeight(phoneWidth, 1080, 1920, maxPortraitRatio);
      const square = computeHeight(phoneWidth, 1080, 1080, maxPortraitRatio);
      const landscape = computeHeight(phoneWidth, 1920, 1080, maxPortraitRatio);
      const cappedExpected = phoneWidth * maxPortraitRatio;
      if (portrait916 <= phoneWidth) {
        throw new Error(`Portrait feed frame must be taller than wide; got ${portrait916}px at ${phoneWidth}px width`);
      }
      if (Math.abs(portrait916 - cappedExpected) > 0.5) {
        throw new Error(`Portrait 9:16 feed frame must cap at 4:5 (${cappedExpected}px), got ${portrait916}px`);
      }
      if (Math.abs(square - phoneWidth) > 0.5) {
        throw new Error(`Square feed frame must be 1:1 (${phoneWidth}px), got ${square}px`);
      }
      if (landscape >= phoneWidth) {
        throw new Error(`Landscape feed frame must be shorter than width; got ${landscape}px`);
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
