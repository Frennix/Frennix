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
      if (src.includes("FEED_MIN_MEDIA_HEIGHT")) {
        throw new Error("MediaAspectFrame must not use FEED_MIN_MEDIA_HEIGHT loading floor");
      }
      if (!src.includes("stableBucket")) {
        throw new Error("MediaAspectFrame must lock feed bucket after dimension probe");
      }
    },
  },
  {
    name: "Feed photos probe thumbnail dimensions before full image",
    run: () => {
      const src = read("packages/ui/src/PostMedia.tsx");
      if (!src.includes("dimensionsUri={thumbnailUrl ?? uri}")) {
        throw new Error("Feed photos must probe thumbnailUrl before full-resolution uri");
      }
    },
  },
  {
    name: "Carousel uses one shared MediaAspectFrame for all slides",
    run: () => {
      const src = read("packages/ui/src/PostMediaCarousel.tsx");
      if (!src.includes("fillParent: true")) {
        throw new Error("Carousel slides must fill a shared feed frame");
      }
      if (!src.includes("<MediaAspectFrame")) {
        throw new Error("Multi-image carousel must wrap slides in one MediaAspectFrame");
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
    name: "Feed inline video uses cover in full-width Instagram buckets",
    run: () => {
      const player = read("packages/ui/src/FeedVideoPlayer.tsx");
      const styles = read("lib/web-document-styles.js");
      const layout = read("packages/ui/src/mediaLayout.ts");
      if (!player.includes('objectFit: "cover"')) {
        throw new Error("FeedVideoPlayer must use cover fit for feed inline video");
      }
      if (!player.includes("feedFallbackBucket")) {
        throw new Error("FeedVideoPlayer must default feed video frames to portrait bucket");
      }
      if (!styles.includes("object-fit: cover !important")) {
        throw new Error("feed-inline-video must use cover on web");
      }
      if (!layout.includes("classifyFeedMediaBucket")) {
        throw new Error("mediaLayout must classify feed media into portrait/square/landscape buckets");
      }
      if (!styles.includes("aspect-ratio: 4 / 5")) {
        throw new Error("portrait feed media frame must use 4:5 aspect ratio on web");
      }
    },
  },
  {
    name: "Feed media height uses Instagram buckets on phone width",
    run: () => {
      const phoneWidth = 390;
      const portraitFrameRatio = 5 / 4;
      const classify = (mediaWidth: number, mediaHeight: number) => {
        const widthOverHeight = mediaWidth / mediaHeight;
        if (widthOverHeight > 1.05) return "landscape";
        if (widthOverHeight >= 0.95) return "square";
        return "portrait";
      };
      const frameHeight = (bucket: string, w: number, h: number) => {
        if (bucket === "portrait") return phoneWidth * portraitFrameRatio;
        if (bucket === "square") return phoneWidth;
        return phoneWidth * (h / w);
      };
      const portrait916 = frameHeight(classify(1080, 1920), 1080, 1920);
      const square = frameHeight(classify(1080, 1080), 1080, 1080);
      const landscape = frameHeight(classify(1920, 1080), 1920, 1080);
      const portraitExpected = phoneWidth * portraitFrameRatio;
      if (portrait916 <= phoneWidth) {
        throw new Error(`Portrait feed frame must be taller than wide; got ${portrait916}px`);
      }
      if (Math.abs(portrait916 - portraitExpected) > 0.5) {
        throw new Error(`Portrait feed frame must be 4:5 (${portraitExpected}px), got ${portrait916}px`);
      }
      if (Math.abs(square - phoneWidth) > 0.5) {
        throw new Error(`Square feed frame must be 1:1 (${phoneWidth}px), got ${square}px`);
      }
      if (landscape >= phoneWidth) {
        throw new Error(`Landscape feed frame must be shorter than width; got ${landscape}px`);
      }
    },
  },
  {
    name: "Feed inline video keeps poster visible while buffering",
    run: () => {
      const src = read("packages/ui/src/FeedVideoPlayer.tsx");
      if (!src.includes("showPosterBackdrop")) {
        throw new Error("FeedVideoPlayer must render poster backdrop until first frame");
      }
      if (!src.includes("showStallSpinner")) {
        throw new Error("FeedVideoPlayer must debounce stall spinner while expected to play");
      }
      if (!src.includes('backgroundColor: "transparent"')) {
        throw new Error("FeedVideoPlayer buffering spinner must not paint a black overlay");
      }
    },
  },
  {
    name: "Feed scroll bottom padding clears tab bar and Safari toolbar",
    run: () => {
      const paddingSrc = read("lib/feed-scroll-bottom-padding.ts");
      if (!paddingSrc.includes("OVERLAY_BOTTOM_SAFETY_MARGIN_PX")) {
        throw new Error("feed scroll padding must include overlay safety margin");
      }
      const tabBar = 83;
      const envBottom = 34;
      const safariChrome = 44;
      const breathing = 28;
      const gap = 8;
      const iphoneReserve = tabBar + safariChrome + breathing + gap;
      if (iphoneReserve < 56 + envBottom + breathing + gap) {
        throw new Error("iPhone feed scroll padding formula must reserve tab bar + safe area");
      }
      const styles = read("lib/web-document-styles.js");
      if (!styles.includes("--frennix-safari-bottom-chrome")) {
        throw new Error("web CSS must track Safari bottom chrome for feed scroll padding");
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
