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
    name: "Feed video player supports autoplay, visibility pause, and mute toggle",
    run: () => {
      const src = read("packages/ui/src/FeedVideoPlayer.tsx");
      if (!src.includes("playbackId")) throw new Error("FeedVideoPlayer must accept playbackId");
      if (!src.includes("useFeedVideoIntersectionObserver")) {
        throw new Error("FeedVideoPlayer must pause using feed scrollport IntersectionObserver");
      }
      if (!src.includes("video.pause()")) {
        throw new Error("FeedVideoPlayer must call video.pause() on the media element");
      }
      if (!src.includes("registerFeedVideoPauseHandler")) {
        throw new Error("FeedVideoPlayer must register imperative pause handlers");
      }
      if (!src.includes("handleScrollIntoView")) {
        throw new Error("FeedVideoPlayer must autoplay when scrolled into view");
      }
      if (!src.includes("ActivityIndicator")) throw new Error("FeedVideoPlayer must show buffering indicator");
      if (!src.includes("Unmute video")) throw new Error("FeedVideoPlayer must expose mute toggle");
      if (!src.includes("onOpenFullscreen")) throw new Error("FeedVideoPlayer must open fullscreen on video tap");
      if (!src.includes("feed-inline-video")) {
        throw new Error("FeedVideoPlayer must disable pointer events on inline web video");
      }
      if (!src.includes("videoRouteHref") || !src.includes("feed-video-route-link")) {
        throw new Error("FeedVideoPlayer must use dedicated /video route anchor links on mobile web");
      }
      if (!src.includes("feed-video-expand-button")) {
        throw new Error("FeedVideoPlayer must expose an expand route link");
      }
      if (!src.includes("OPEN_VIEWER_TAP_MOVE_PX")) {
        throw new Error("FeedVideoPlayer must distinguish tap from scroll");
      }
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
    name: "Carousel passes playback scope and slide active state for feed videos",
    run: () => {
      const carousel = read("packages/ui/src/PostMediaCarousel.tsx");
      const slot = read("packages/ui/src/FeedMediaSlot.tsx");
      const postMedia = read("packages/ui/src/PostMedia.tsx");
      if (!carousel.includes("playbackScopeId")) throw new Error("carousel must accept playbackScopeId");
      if (!carousel.includes("slideActive")) throw new Error("carousel must pass slideActive to PostMedia");
      if (!slot.includes("playbackScopeId")) throw new Error("FeedMediaSlot must pass playbackScopeId");
      if (!postMedia.includes("buildFeedVideoPlaybackId")) {
        throw new Error("PostMedia must build feed video playback ids");
      }
    },
  },
  {
    name: "Feed coordinates a single active inline video",
    run: () => {
      const coordinator = read("packages/ui/src/feedVideoPlaybackCoordinator.ts");
      const gate = read("packages/ui/src/FeedVideoPlaybackGate.tsx");
      const feed = read("app/(tabs)/index.tsx");
      const observer = read("packages/ui/src/useFeedVideoIntersectionObserver.ts");
      if (!observer.includes('FEED_SCROLL_ROOT_ID = "feed-scroll-list"')) {
        throw new Error("feed video observer must use feed-scroll-list root");
      }
      if (!coordinator.includes("registerFeedVideoPauseHandler")) {
        throw new Error("feed video coordinator must register pause handlers");
      }
      if (!coordinator.includes("requestFeedVideoPlay")) {
        throw new Error("feed video coordinator must expose requestFeedVideoPlay");
      }
      if (!observer.includes("onAboveThreshold")) {
        throw new Error("feed video observer must support autoplay on visibility");
      }
      if (!gate.includes("useIsFocused")) {
        throw new Error("FeedVideoPlaybackGate must pause when leaving the Feed tab");
      }
      if (!feed.includes("FeedVideoPlaybackGate")) {
        throw new Error("Home feed must mount FeedVideoPlaybackGate");
      }
      if (!feed.includes("useFeedCommentsSheet")) {
        throw new Error("Home feed must open comments as an overlay sheet");
      }
      if (feed.includes("FeedVideoPlaybackProvider")) {
        throw new Error("Home feed must not wrap startup in FeedVideoPlaybackProvider");
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
      if (!lightbox.includes('contentFit="cover"')) throw new Error("gallery images must use cover");
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
