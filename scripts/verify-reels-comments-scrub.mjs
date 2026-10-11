#!/usr/bin/env node
/**
 * Reel comments sheet visibility + Instagram-style scrub bar wiring.
 *
 * Usage:
 *   node scripts/verify-reels-comments-scrub.mjs
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
  console.log("verify-reels-comments-scrub\n");
  let ok = true;
  const sheet = readSource("components/CommentsBottomSheet.tsx");
  const content = readSource("components/PostCommentsContent.tsx");
  const viewer = readSource("components/ImmersiveVideoViewer.tsx");
  const playlist = readSource("components/ImmersiveVideoPlaylistViewer.tsx");
  const slide = readSource("packages/ui/src/FullscreenVideoSlide.tsx");
  const overlayZ = readSource("lib/overlay-z-index.ts");
  const viewport = readSource("lib/video-overlay-visual-viewport-layout.ts");
  const styles = readSource("lib/web-document-styles.js");
  const portal = readSource("components/VideoOverlayWebComposerPortal.tsx");
  const scrubber = readSource("components/ReelScrubBar.tsx");

  ok =
    pass(
      "Video overlay comments sit above the lightbox",
      overlayZ.includes("commentsVideoOverlay: 100001") &&
        overlayZ.includes("imageLightbox: 99999") &&
        overlayZ.includes("commentOptions: 100002") &&
        sheet.includes("COMMENTS_VIDEO_OVERLAY_Z_INDEX")
    ) && ok;

  ok =
    pass(
      "Comments list lives inside the sheet body, not a header-only chrome shell",
      sheet.includes("data-frennix-comments-sheet-body") &&
        sheet.includes("data-frennix-comments-sheet-surface") &&
        sheet.includes("videoOverlaySheetColumn") &&
        !sheet.includes("VIDEO_PEEK_KEYBOARD_OPEN_PX")
    ) && ok;

  ok =
    pass(
      "Sheet always exposes loading, empty, error+retry, or comments",
      content.includes("Loading comments") &&
        content.includes("No comments yet") &&
        content.includes("Could not load comments") &&
        content.includes("Retry") &&
        content.includes("refetchComments") &&
        content.includes("<CommentThread") &&
        !content.includes("BODY OK")
    ) && ok;

  ok =
    pass(
      "Safari toolbar gap is not treated as the keyboard",
      viewport.includes("isVideoOverlayKeyboardOpen") &&
        viewport.includes("KEYBOARD_OPEN_THRESHOLD_PX = 140") &&
        readSource("lib/web-document-styles.js").includes(
          'body[data-frennix-comments-open="true"] [data-frennix-comments-video-overlay="true"]'
        ) &&
        viewport.includes("getImmersiveSessionLayoutHeight()") &&
        viewport.includes("baselineHeight - snapshot.visualHeight") &&
        !viewport.includes("isVisualViewportKeyboardOpen(snapshot)")
    ) && ok;

  ok =
    pass(
      "Video overlay composer stays in the sheet above the safe area",
      sheet.includes("data-frennix-comment-composer-host") &&
        sheet.includes("videoOverlayComposerInset") &&
        !readSource("components/PostCommentsSheet.tsx").includes("VideoOverlayWebComposerPortal") &&
        !/comments-video-overlay="true"\][\s\S]{0,180}textarea[\s\S]{0,80}display: none/.test(styles) &&
        styles.includes("[data-frennix-comments-sheet-body")
    ) && ok;

  ok =
    pass(
      "Session layout height freezes peek across comments open/close",
      sheet.includes("captureImmersiveSessionLayoutHeight") &&
        viewer.includes("getImmersiveSessionLayoutHeight") &&
        readSource("components/ImageLightbox.tsx").includes("clearImmersiveSessionLayoutHeight")
    ) && ok;

  ok =
    pass(
      "Reel scrub bar sits above the comment field",
      viewer.includes("<ReelScrubBar") &&
        viewer.includes("commentComposerHost") &&
        viewer.includes("data-frennix-reel-bottom-chrome") &&
        viewer.includes("data-frennix-reel-comment-field") &&
        /bottomChrome[\s\S]*bottomMeta[\s\S]*ReelScrubBar[\s\S]*Add a comment/.test(viewer) &&
        !/bottomMeta: \{[\s\S]*position: "absolute"[\s\S]*bottom: 0/.test(viewer) &&
        scrubber.includes("TOUCH_HEIGHT") &&
        scrubber.includes("beginScrub") &&
        scrubber.includes("wasPlayingRef") &&
        scrubber.includes("getVideoElement")
    ) && ok;

  ok =
    pass(
      "Fullscreen slide exposes seek without changing immersive autoplay",
      slide.includes("seekTo: (time: number, options?: { silent?: boolean })") &&
        slide.includes("getDuration:") &&
        slide.includes("getVideoElement:") &&
        !slide.includes("videoRef.current?.pause()")
    ) && ok;

  ok =
    pass(
      "Horizontal scrubbing locks vertical Reel navigation",
      playlist.includes("onScrubbingChange") &&
        playlist.includes('data-frennix-reel-scrubbing') &&
        playlist.includes('overflowY: scrubbing ? "hidden"') &&
        styles.includes("data-frennix-reel-scrubbing") &&
        styles.includes("touch-action: none")
    ) && ok;

  ok =
    pass(
      "Upload helpers are left in place",
      readSource("lib/media-duration.ts").includes("export function isVideoTooLong") &&
        readSource("packages/api/src/upload-utils.ts").includes("validateMediaUploadSize")
    ) && ok;

  console.log("");
  console.log(ok ? "All checks passed." : "Some checks failed.");
  process.exit(ok ? 0 : 1);
}

main();
