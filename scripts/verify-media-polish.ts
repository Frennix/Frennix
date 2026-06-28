/**
 * Regression checks for media polish: progressive loading, caching, video-ready types.
 * Run: pnpm verify:media-polish
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
    name: "ProgressiveImage shows skeleton and fades in on load",
    run: () => {
      const src = read("packages/ui/src/ProgressiveImage.tsx");
      if (!src.includes("<Skeleton")) throw new Error("ProgressiveImage must show skeleton while loading");
      if (!src.includes("Animated.timing")) throw new Error("ProgressiveImage must fade in after load");
      if (!src.includes("onLoadEnd")) throw new Error("ProgressiveImage must handle onLoadEnd for Safari");
      if (!src.includes("colors.surfaceElevated")) {
        throw new Error("ProgressiveImage must use elevated surface background, not black");
      }
    },
  },
  {
    name: "CachedImage uses memory-disk cache and skips video prefetch",
    run: () => {
      const src = read("packages/ui/src/CachedImage.tsx");
      if (!src.includes('cachePolicy = "memory-disk"')) {
        throw new Error("CachedImage must default to memory-disk cache");
      }
      if (!src.includes("isImageMediaUri")) {
        throw new Error("prefetch must skip non-image URIs");
      }
    },
  },
  {
    name: "Feed prefetch warms thumbnails then image URLs only",
    run: () => {
      const src = read("lib/prefetch-post-images.ts");
      if (!src.includes("filterImagePrefetchUris")) {
        throw new Error("prefetchPostImages must filter video URLs");
      }
    },
  },
  {
    name: "Carousel preloads neighbor images",
    run: () => {
      const src = read("packages/ui/src/PostMediaCarousel.tsx");
      if (!src.includes("prefetchCachedImages(neighbors)")) {
        throw new Error("PostMediaCarousel must prefetch adjacent slides");
      }
    },
  },
  {
    name: "Lightbox reuses cached images with optional placeholders",
    run: () => {
      const lightbox = read("components/ImageLightbox.tsx");
      const hook = read("lib/useImageLightbox.tsx");
      if (!lightbox.includes("ProgressiveImage")) {
        throw new Error("ImageLightbox must use ProgressiveImage for fade-in");
      }
      if (!lightbox.includes("placeholderUris")) {
        throw new Error("ImageLightbox must accept placeholder URIs");
      }
      if (!lightbox.includes("prefetchCachedImages")) {
        throw new Error("ImageLightbox must prefetch neighbor images");
      }
      if (!hook.includes("OpenGalleryOptions")) {
        throw new Error("useImageLightbox must accept gallery options");
      }
    },
  },
  {
    name: "Post media typed for future video without breaking photos",
    run: () => {
      const types = read("packages/types/src/post-media.ts");
      const carousel = read("packages/ui/src/PostMediaCarousel.tsx");
      if (!types.includes("PostMediaKind")) throw new Error("PostMediaKind type required");
      if (!types.includes("normalizePostMediaItems")) {
        throw new Error("normalizePostMediaItems helper required");
      }
      if (!carousel.includes("normalizePostMediaItems")) {
        throw new Error("PostMediaCarousel must use normalized media items");
      }
      if (!carousel.includes("mediaItems.length === 1")) {
        throw new Error("Single-image posts must short-circuit carousel UI");
      }
    },
  },
  {
    name: "Feed defers media mount for scroll performance",
    run: () => {
      const src = read("packages/ui/src/FeedMediaSlot.tsx");
      if (!src.includes("FeedMediaSkeleton")) {
        throw new Error("FeedMediaSlot must show skeleton before active");
      }
      if (!src.includes("PostMediaCarousel")) {
        throw new Error("FeedMediaSlot must mount carousel once active");
      }
    },
  },
  {
    name: "Gallery index restore preserved after media polish",
    run: () => {
      const feed = read("app/(tabs)/index.tsx");
      if (!feed.includes("galleryPlaceholderUris")) {
        throw new Error("Feed must pass gallery placeholders when opening lightbox");
      }
      if (!feed.includes("setCarouselIndex(post.id, finalIndex)")) {
        throw new Error("Feed must restore carousel index on gallery close");
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
console.log(`\nAll ${checks.length} media polish checks passed.`);
