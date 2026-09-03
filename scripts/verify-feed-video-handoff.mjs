#!/usr/bin/env node
/**
 * Regression: feed → fullscreen reuses one HTMLVideoElement with synchronous overlay open.
 *
 * Usage:
 *   node scripts/verify-feed-video-handoff.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function pass(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

function readSource(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function main() {
  console.log("verify-feed-video-handoff\n");
  let ok = true;

  const coordinator = readSource("packages/ui/src/feedVideoPlaybackCoordinator.ts");
  const dom = readSource("packages/ui/src/feedVideoDom.ts");
  const feedPlayer = readSource("packages/ui/src/FeedVideoPlayer.tsx");
  const fullscreen = readSource("packages/ui/src/FullscreenVideoSlide.tsx");
  const gallery = readSource("lib/useMediaGallery.tsx");
  const feedIndex = readSource("app/(tabs)/index.tsx");

  ok =
    pass(
      "Coordinator marks fullscreen handoff before pausing other feed videos",
      coordinator.includes("fullscreenHandoffPlaybackId") &&
        coordinator.includes("setFeedVideoFullscreenHandoff") &&
        coordinator.includes("id === fullscreenHandoffPlaybackId")
    ) && ok;

  ok =
    pass(
      "Shared feed video DOM registry supports adopt and return",
      dom.includes("adoptFeedVideoDomForFullscreen") &&
        dom.includes("returnFeedVideoDomFromFullscreen") &&
        dom.includes("registerFeedVideoDom")
    ) && ok;

  ok =
    pass(
      "Feed player uses imperative mount (no React-managed duplicate video)",
      feedPlayer.includes("feed-video-mount") &&
        feedPlayer.includes("document.createElement(\"video\")") &&
        feedPlayer.includes("registerFeedVideoDom")
    ) && ok;

  ok =
    pass(
      "Feed player suppresses buffering overlay during fullscreen handoff",
      feedPlayer.includes("isFeedVideoFullscreenHandoff") &&
        feedPlayer.includes("showBufferingSpinner") &&
        feedPlayer.includes("videoDomAdopted")
    ) && ok;

  ok =
    pass(
      "Feed player keeps poster visible until first rendered frame",
      feedPlayer.includes("showPosterBackdrop") &&
        feedPlayer.includes("hasRenderedFrame") &&
        feedPlayer.includes("presentationPosterUri") &&
        feedPlayer.includes("posterLayer")
    ) && ok;

  ok =
    pass(
      "Feed buffering spinner stays transparent over poster or last frame",
      feedPlayer.includes("bufferingSpinnerLayer") &&
        feedPlayer.includes('backgroundColor: "transparent"') &&
        feedPlayer.includes('size="small"') &&
        feedPlayer.includes("FEED_VIDEO_STALL_SPINNER_MS")
    ) && ok;

  ok =
    pass(
      "Feed video preloads one screen ahead with capped concurrent slots",
      readSource("packages/ui/src/useFeedVideoIntersectionObserver.ts").includes(
        'FEED_VIDEO_PRELOAD_ROOT_MARGIN = "100% 0px 100% 0px"'
      ) &&
        readSource("packages/ui/src/feedVideoPreloadCoordinator.ts").includes(
          "FEED_VIDEO_MAX_PRELOAD_SLOTS = 3"
        ) &&
        feedPlayer.includes("setFeedVideoPreloadCandidate") &&
        feedPlayer.includes("preloadGranted")
    ) && ok;

  ok =
    pass(
      "Upload pipeline generates stored video thumbnails",
      readSource("lib/share-workout.ts").includes("generateAndUploadVideoThumbnail") &&
        readSource("lib/share-workout.ts").includes("thumbnail_url: thumbnailUrl")
    ) && ok;

  ok =
    pass(
      "Feed passes post thumbnail_url into FeedVideoPlayer",
      readSource("packages/ui/src/PostMedia.tsx").includes("thumbnailUrl={thumbnailUrl}") &&
        readSource("packages/ui/src/PostMedia.tsx").includes("posterState={posterState}")
    ) && ok;

  ok =
    pass(
      "Fullscreen slide adopts feed element instead of always creating a new video",
      fullscreen.includes("adoptFeedVideoDomForFullscreen") &&
        fullscreen.includes("returnFeedVideoDomFromFullscreen") &&
        fullscreen.includes("usingAdoptedFeedVideo") &&
        fullscreen.includes("fullscreen-video-mount")
    ) && ok;

  ok =
    pass(
      "Fullscreen poster/spinner hidden when inline video was already ready",
      fullscreen.includes("inlineReadyAtHandoffRef") &&
        fullscreen.includes("buffering && !inlineReadyAtHandoffRef.current")
    ) && ok;

  ok =
    pass(
      "Gallery opens synchronously on video tap (flushSync)",
      gallery.includes("flushSync") && gallery.includes("options?.videoHandoff")
    ) && ok;

  ok =
    pass(
      "Feed tap sets handoff id before opening gallery",
      (() => {
        const start = feedIndex.indexOf("onMediaPress: (post: Post");
        const block = feedIndex.slice(start, start + 900);
        return (
          block.includes("setFeedVideoFullscreenHandoff(playbackId)") &&
          block.includes("openGallery(") &&
          block.indexOf("setFeedVideoFullscreenHandoff(playbackId)") <
            block.indexOf("openGallery(")
        );
      })()
    ) && ok;

  ok =
    pass(
      "No video.load() during fullscreen handoff path",
      !fullscreen.includes(".load()") &&
        !dom.includes(".load()") &&
        feedPlayer.includes("preloadGranted") &&
        feedPlayer.includes("HAVE_NOTHING")
    ) && ok;

  ok =
    pass(
      "Feed slot keeps poster placeholder while video is reparented",
      feedPlayer.includes("adoptedPoster") && feedPlayer.includes("ProgressiveImage")
    ) && ok;

  console.log("");
  console.log(ok ? "All checks passed." : "Some checks failed.");
  process.exit(ok ? 0 : 1);
}

main();
