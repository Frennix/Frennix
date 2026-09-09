#!/usr/bin/env node
/**
 * Regression: vertical immersive video playlist from feed with handoff preserved.
 *
 * Usage:
 *   node scripts/verify-immersive-video-playlist.mjs
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
  console.log("verify-immersive-video-playlist\n");
  let ok = true;

  const playlist = readSource("lib/immersive-video-playlist.ts");
  const playlistViewer = readSource("components/ImmersiveVideoPlaylistViewer.tsx");
  const overlayShell = readSource("components/ImmersiveVideoOverlayShell.tsx");
  const lightbox = readSource("components/ImageLightbox.tsx");
  const gallery = readSource("lib/useMediaGallery.tsx");
  const feedIndex = readSource("app/(tabs)/index.tsx");
  const styles = readSource("lib/web-document-styles.js");
  const immersive = readSource("components/ImmersiveVideoViewer.tsx");

  ok =
    pass(
      "Playlist builder extracts video posts and finds initial index",
      playlist.includes("buildFeedVideoPlaylistFromPosts") &&
        playlist.includes("mergeUniquePlaylistEntries") &&
        playlist.includes("buildFeedVideoPlaybackId")
    ) && ok;

  ok =
    pass(
      "Playlist viewer uses controlled swipe gestures and preloads adjacent slides only",
      playlistViewer.includes("PRELOAD_RADIUS = 1") &&
        playlistViewer.includes("SWIPE_DISTANCE_PX") &&
        playlistViewer.includes("handleWebPointerDown") &&
        playlistViewer.includes("data-frennix-playlist-swipe-surface") &&
        playlistViewer.includes("shouldRenderIndex") &&
        playlistViewer.includes("data-frennix-immersive-video-playlist") &&
        !playlistViewer.includes("scrollSnapType") &&
        !playlistViewer.includes("overflowY: \"scroll\"")
    ) && ok;

  ok =
    pass(
      "Non-handoff slides use routePlayback to avoid feed coordinator conflicts",
      playlistViewer.includes("slideRoutePlayback") &&
        playlistViewer.includes("routePlayback={slideRoutePlayback}")
    ) && ok;

  ok =
    pass(
      "Playlist viewer applies feed handoff only to initial tapped slide",
      playlistViewer.includes("initialHandoffPlaybackId") &&
        playlistViewer.includes("handoffAppliedRef") &&
        playlistViewer.includes("canApplyHandoff")
    ) && ok;

  ok =
    pass(
      "Playlist viewer passes isActive to ImmersiveVideoViewer per slide",
      playlistViewer.includes("isActive={isActive}") &&
        immersive.includes("isActive")
    ) && ok;

  ok =
    pass(
      "Overlay shell opens comments without navigating away",
      overlayShell.includes("PostCommentsSheet") &&
        overlayShell.includes('presentation="videoOverlay"') &&
        overlayShell.includes("openCommentsOverlay")
    ) && ok;

  ok =
    pass(
      "Lightbox renders overlay shell for vertical playlist",
      lightbox.includes("ImmersiveVideoOverlayShell") &&
        lightbox.includes("useImmersiveVideoPlaylist") &&
        lightbox.includes("immersiveVideoPlaylist")
    ) && ok;

  ok =
    pass(
      "Lightbox disables swipe-to-dismiss while vertical playlist is open",
      lightbox.includes("!useImmersiveVideoPlaylist") &&
        lightbox.includes("useImmersiveVideoPlaylist || zoomed")
    ) && ok;

  ok =
    pass(
      "Gallery state carries immersive video playlist options",
      gallery.includes("immersiveVideoPlaylist") &&
        gallery.includes("ImmersiveVideoPlaylistState")
    ) && ok;

  ok =
    pass(
      "Feed tap builds playlist from loaded posts with pagination fetch",
      feedIndex.includes("buildFeedVideoPlaylistFromPosts") &&
        feedIndex.includes("immersiveVideoPlaylist") &&
        feedIndex.includes("buildPlaylistEntriesFromPosts") &&
        feedIndex.includes("fetchMore:")
    ) && ok;

  ok =
    pass(
      "Feed tap still sets handoff before opening gallery",
      (() => {
        const marker = "const openFeedMediaGallery = (";
        const start = feedIndex.indexOf(marker);
        const block = feedIndex.slice(start, start + 3200);
        return (
          start >= 0 &&
          block.includes("setFeedVideoFullscreenHandoff(playbackId)") &&
          block.includes("openGallery(") &&
          block.indexOf("setFeedVideoFullscreenHandoff(playbackId)") <
            block.indexOf("openGallery(")
        );
      })()
    ) && ok;

  ok =
    pass(
      "Closing playlist restores saved feed scroll position",
      feedIndex.includes("requestFeedScrollReturnRestore") &&
        feedIndex.includes("saveFeedScrollReturnState") &&
        lightbox.includes("playlistCloseContextRef") &&
        playlistViewer.includes("onActiveEntryChange")
    ) && ok;

  ok =
    pass(
      "Web CSS keeps the playlist stage clipped without native scroll-snap",
      styles.includes("frennix-immersive-video-playlist-scroll") &&
        styles.includes("touch-action: none") &&
        !styles.includes("scroll-snap-type: y mandatory")
    ) && ok;

  const playlistStageCssStart = styles.indexOf(".frennix-immersive-video-playlist-scroll {");
  const playlistStageCss = styles.slice(
    playlistStageCssStart,
    playlistStageCssStart >= 0 ? playlistStageCssStart + 280 : 0
  );
  const immersiveFillCssStart = styles.indexOf(
    '[data-frennix-immersive-video-viewer="true"] .fullscreen-video-mount'
  );
  const immersiveFillCssEnd = styles.indexOf(
    "[data-frennix-immersive-top-bar=\"true\"]",
    immersiveFillCssStart
  );
  const immersiveFillCss = styles.slice(
    immersiveFillCssStart,
    immersiveFillCssEnd > immersiveFillCssStart
      ? immersiveFillCssEnd
      : immersiveFillCssStart + 220
  );

  ok =
    pass(
      "Web playlist advances by gesture threshold, not finger-dragged scrolling",
      playlistStageCssStart >= 0 &&
        playlistStageCss.includes("overflow: hidden") &&
        playlistStageCss.includes("touch-action: none") &&
        !playlistStageCss.includes("overflow-y: scroll") &&
        !playlistStageCss.includes("scroll-snap") &&
        playlistViewer.includes("data-frennix-playlist-active-index") &&
        playlistViewer.includes("visibility: isActive ? \"visible\" : \"hidden\"") &&
        playlistViewer.includes("finishWebSwipe") &&
        playlistViewer.includes("SWIPE_VELOCITY_PX_PER_MS")
    ) && ok;

  ok =
    pass(
      "Immersive video fill stays inside the slide, not pinned to the overlay",
      immersiveFillCssStart >= 0 &&
        immersiveFillCss.includes("position: absolute") &&
        immersiveFillCss.includes("width: 100%") &&
        immersiveFillCss.includes("height: 100%") &&
        !immersiveFillCss.includes("right: 0") &&
        !immersiveFillCss.includes("bottom: 0")
    ) && ok;

  ok =
    pass(
      "Adjacent playlist videos preload without playing",
      readSource("packages/ui/src/FullscreenVideoSlide.tsx").includes(
        'preload: immersiveMode || isActive ? "auto" : "metadata"'
      ) &&
        readSource("packages/ui/src/FullscreenVideoSlide.tsx").includes(
          "data-frennix-playlist-swipe-surface"
        ) &&
        playlistViewer.includes("isActive={isActive}") &&
        readSource("packages/ui/src/FullscreenVideoSlide.tsx").includes("if (!isActive || failed)") &&
        readSource("packages/ui/src/FullscreenVideoSlide.tsx").includes("video.pause()")
    ) && ok;

  ok =
    pass(
      "Pagination merge deduplicates appended playlist entries",
      playlist.includes("mergeUniquePlaylistEntries") &&
        playlistViewer.includes("mergeUniquePlaylistEntries")
    ) && ok;

  ok =
    pass(
      "Swipe capture excludes chrome controls and waits for a vertical lock",
      playlistViewer.includes("isPlaylistChromeTarget") &&
        playlistViewer.includes("[data-frennix-immersive-control='true']") &&
        playlistViewer.includes("captured: false") &&
        playlistViewer.includes("if (!gesture.captured)") &&
        immersive.includes('data-frennix-immersive-control') &&
        immersive.includes("function RailAction(")
    ) && ok;

  console.log(`\n${ok ? "All checks passed." : "Some checks failed."}`);
  process.exit(ok ? 0 : 1);
}

main();
