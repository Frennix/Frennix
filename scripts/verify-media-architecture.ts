/**
 * Architecture checks for future-proof mixed photo/video media system.
 * Run: pnpm verify:media-architecture
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
    name: "Post media types support mixed photo/video items",
    run: () => {
      const src = read("packages/types/src/post-media.ts");
      if (!src.includes("PostMediaKind")) throw new Error("PostMediaKind required");
      if (!src.includes("buildMediaGalleryState")) throw new Error("buildMediaGalleryState required");
      if (!src.includes("galleryNeighborImageUris")) throw new Error("galleryNeighborImageUris required");
    },
  },
  {
    name: "Feed video player supports visibility autoplay and mute toggle",
    run: () => {
      const src = read("packages/ui/src/FeedVideoPlayer.tsx");
      if (!src.includes("shouldPlay")) throw new Error("FeedVideoPlayer must accept shouldPlay");
      if (!src.includes("ActivityIndicator")) throw new Error("FeedVideoPlayer must show buffering indicator");
      if (!src.includes("Unmute video")) throw new Error("FeedVideoPlayer must expose mute toggle");
      if (!src.includes("onOpenFullscreen")) throw new Error("FeedVideoPlayer must support fullscreen tap");
    },
  },
  {
    name: "Fullscreen gallery renders video slides",
    run: () => {
      const lightbox = read("components/ImageLightbox.tsx");
      if (!lightbox.includes("FullscreenVideoSlide")) {
        throw new Error("ImageLightbox must render FullscreenVideoSlide for video items");
      }
      if (!lightbox.includes('item.kind === "video"')) {
        throw new Error("ImageLightbox must branch on media kind");
      }
    },
  },
  {
    name: "Carousel passes visibility and slide active state for video autoplay",
    run: () => {
      const carousel = read("packages/ui/src/PostMediaCarousel.tsx");
      const slot = read("packages/ui/src/FeedMediaSlot.tsx");
      if (!carousel.includes("mediaVisible")) throw new Error("carousel must accept mediaVisible");
      if (!carousel.includes("slideActive")) throw new Error("carousel must pass slideActive to PostMedia");
      if (!slot.includes("mediaVisible={visible && active}")) {
        throw new Error("FeedMediaSlot must gate video autoplay on viewport visibility");
      }
    },
  },
  {
    name: "Media load errors expose retry affordance",
    run: () => {
      const error = read("packages/ui/src/MediaLoadError.tsx");
      const progressive = read("packages/ui/src/ProgressiveImage.tsx");
      if (!error.includes("Retry")) throw new Error("MediaLoadError must include retry button");
      if (!progressive.includes("MediaLoadError")) {
        throw new Error("ProgressiveImage must use MediaLoadError on failure");
      }
    },
  },
  {
    name: "Unified media gallery hook supports typed items",
    run: () => {
      const hook = read("lib/useMediaGallery.tsx");
      if (!hook.includes("openMediaGallery")) throw new Error("useMediaGallery must expose openMediaGallery");
      if (!hook.includes("buildMediaGalleryState")) throw new Error("useMediaGallery must build typed gallery state");
    },
  },
  {
    name: "Image prefetch skips video files in feed warmup",
    run: () => {
      const prefetch = read("lib/prefetch-post-images.ts");
      if (!prefetch.includes("filterImagePrefetchUris")) {
        throw new Error("prefetchPostImages must skip video URLs");
      }
    },
  },
  {
    name: "Existing photo gallery zoom behavior preserved",
    run: () => {
      const lightbox = read("components/ImageLightbox.tsx");
      if (!lightbox.includes("NativeZoomableImage")) throw new Error("native zoom must remain");
      if (!lightbox.includes("scrollEnabled={scrollEnabled}")) {
        throw new Error("gallery scroll must disable while image zoomed");
      }
      if (!lightbox.includes('contentFit="contain"')) throw new Error("gallery images must use contain");
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
console.log(`\nAll ${checks.length} media architecture checks passed.`);
