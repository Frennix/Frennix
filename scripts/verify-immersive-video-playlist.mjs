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
      "Playlist viewer uses scroll snap and preloads adjacent slides only",
      playlistViewer.includes("PRELOAD_RADIUS = 1") &&
        playlistViewer.includes("scrollSnapType") &&
        playlistViewer.includes("shouldRenderIndex") &&
        playlistViewer.includes("data-frennix-immersive-video-playlist")
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
        immersive.includes("isActive={isActive}")
    ) && ok;

  ok =
    pass(
      "Lightbox renders playlist viewer instead of horizontal gallery",
      lightbox.includes("ImmersiveVideoPlaylistViewer") &&
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
        const marker = "onMediaPress: (post: Post, uri: string, index: number)";
        const start = feedIndex.indexOf(marker);
        const block = feedIndex.slice(start, start + 3200);
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
      "Web CSS defines vertical scroll-snap playlist container",
      styles.includes("frennix-immersive-video-playlist-scroll") &&
        styles.includes("scroll-snap-type: y mandatory")
    ) && ok;

  ok =
    pass(
      "Closing playlist reports active entry for feed carousel restore",
      lightbox.includes("onActiveEntryChange") &&
        lightbox.includes("playlistCloseContextRef") &&
        playlistViewer.includes("onActiveEntryChange")
    ) && ok;

  ok =
    pass(
      "Pagination merge deduplicates appended playlist entries",
      playlist.includes("mergeUniquePlaylistEntries") &&
        playlistViewer.includes("mergeUniquePlaylistEntries")
    ) && ok;

  console.log(`\n${ok ? "All checks passed." : "Some checks failed."}`);
  process.exit(ok ? 0 : 1);
}

main();
