#!/usr/bin/env node
/**
 * Regression: mobile web comments must use one full-screen opaque modal layout.
 *
 * Usage:
 *   node scripts/verify-comments-fullscreen-layout.mjs
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
  console.log("verify-comments-fullscreen-layout\n");
  let ok = true;
  const sheet = readSource("components/CommentsBottomSheet.tsx");
  const styles = readSource("lib/web-document-styles.js");
  const viewport = readSource("lib/safari-visual-viewport.ts");
  const lock = readSource("lib/web-modal-scroll-lock.ts");

  ok =
    pass(
      "Mobile web uses full-screen comments path",
      sheet.includes("isMobileWebFullscreenMode") && sheet.includes("data-frennix-comments-fullscreen")
    ) && ok;
  ok =
    pass(
      "Full-screen root height uses measured visual viewport",
      sheet.includes("measureSafariVisualViewport") &&
        sheet.includes("mobileVisualHeight") &&
        !sheet.includes("keyboardInset")
    ) && ok;
  ok =
    pass(
      "No partial-height sheet ratio on mobile web path",
      !sheet.includes("SHEET_OPEN_RATIO") || sheet.includes("isMobileWebFullscreenMode")
    ) && ok;
  const mobileBlock = sheet.match(/const mobileWebSurface = \([\s\S]*?\n  \);/)?.[0] ?? "";
  ok =
    pass(
      "Mobile web full-screen surface has no translateY transform",
      mobileBlock.length > 0 && !mobileBlock.includes("translateY")
    ) && ok;
  ok =
    pass(
      "Comments list uses flex:1 min-height:0 overflow-y:auto",
      sheet.includes("flex: 1") && sheet.includes("minHeight: 0") && sheet.includes('overflowY: "auto"')
    ) && ok;
  ok =
    pass(
      "Fullscreen and video overlay composers stay inline flex children",
      sheet.includes("composerHost") &&
        sheet.includes("flexShrink: 0") &&
        readSource("components/PostCommentsSheet.tsx").includes("useVideoOverlayWebComposer: false") &&
        !readSource("components/PostCommentsSheet.tsx").includes("VideoOverlayWebComposerPortal")
    ) && ok;
  ok =
    pass(
      "Close blurs active web input",
      sheet.includes("blurActiveWebInput")
    ) && ok;
  ok =
    pass(
      "Opaque full-screen CSS guard exists",
      styles.includes("data-frennix-comments-fullscreen") && styles.includes("opacity: 1")
    ) && ok;
  ok =
    pass(
      "readVisualViewportHeight exported",
      viewport.includes("export function readVisualViewportHeight")
    ) && ok;
  ok =
    pass(
      "Scroll lock does not mutate feed scroll list",
      !lock.includes('getElementById("feed-scroll-list")') ||
        (!lock.includes('feed.style.touchAction = "none"') && !lock.includes('feed.style.overflow'))
    ) && ok;
  ok =
    pass(
      "Single comments entry point preserved",
      readSource("lib/useFeedCommentsSheet.tsx").includes("PostCommentsSheet") &&
        readSource("components/PostCommentsSheet.tsx").includes("CommentsBottomSheet")
    ) && ok;
  ok =
    pass(
      "Comment options z-index above comments sheet and video overlay",
      readSource("lib/overlay-z-index.ts").includes("commentOptions: 100002") &&
        readSource("lib/overlay-z-index.ts").includes("commentsVideoOverlay: 100001")
    ) && ok;
  ok =
    pass(
      "16px comment input preserved",
      readSource("components/PostCommentsContent.tsx").includes('Platform.OS === "web" ? 16 : 15')
    ) && ok;
  const lightbox = readSource("components/ImageLightbox.tsx");
  const viewer = readSource("components/ImmersiveVideoViewer.tsx");
  const playlist = readSource("components/ImmersiveVideoPlaylistViewer.tsx");
  const slide = readSource("packages/ui/src/FullscreenVideoSlide.tsx");
  const viewportLayout = readSource("lib/video-overlay-visual-viewport-layout.ts");
  const peekGeometry = readSource("lib/video-overlay-peek-geometry.ts");
  ok =
    pass(
      "iOS focus safeguards remain (no capture / preventDefault / delayed focus)",
      sheet.includes('touchAction: "manipulation"') &&
        !sheet.includes("stopPointerEventPropagation") &&
        !sheet.includes("preventDefault") &&
        readSource("components/WebCommentComposerRow.tsx").includes("focus({ preventScroll: true })")
    ) && ok;
  ok =
    pass(
      "No VIDEO_PEEK_KEYBOARD_OPEN_PX constant returns",
      !sheet.includes("VIDEO_PEEK_KEYBOARD_OPEN_PX") &&
        !viewportLayout.includes("VIDEO_PEEK_KEYBOARD_OPEN_PX") &&
        !peekGeometry.includes("VIDEO_PEEK_KEYBOARD_OPEN_PX") &&
        !viewer.includes("VIDEO_PEEK_KEYBOARD_OPEN_PX") &&
        !styles.includes("VIDEO_PEEK_KEYBOARD_OPEN_PX")
    ) && ok;
  ok =
    pass(
      "Comments-open video uses contain at 100% of the peek stage",
      viewer.includes('commentsOverlayOpen ? "contain" : "cover"') &&
        slide.includes("objectFit: mediaFit") &&
        slide.includes("contentFit={mediaFit}") &&
        styles.includes("object-fit: contain !important")
    ) && ok;
  ok =
    pass(
      "Comments-open stage uses layout viewport without wildcard overflow",
      lightbox.includes("freezeImmersiveLayout") &&
        lightbox.includes("immersiveStageHeight") &&
        lightbox.includes("layoutViewportHeight") &&
        lightbox.includes("freezeImmersiveLayout ? null : { transform: [{ translateY: dismissY }] }") &&
        lightbox.includes("data-frennix-lightbox-stage-shell") &&
        styles.includes('[data-frennix-lightbox="true"][data-frennix-immersive-comments-open="true"]') &&
        styles.includes('[data-frennix-lightbox-stage-shell="true"]') &&
        !styles.includes('[data-frennix-lightbox="true"][data-frennix-immersive-comments-open="true"] *') &&
        !/\[[^\]]+comments-open[^\]]*\]\s+\*\s*\{/.test(styles)
    ) && ok;
  ok =
    pass(
      "Video-stage hosts stay clipped; playlist slides stay clipped",
      viewer.includes('overflow: "hidden"') &&
        styles.includes('[data-frennix-video-stage-host="true"]') &&
        playlist.includes('overflow: "hidden"') &&
        playlist.includes("handleWebPointerDown") &&
        !playlist.includes('overflowY: "scroll"')
    ) && ok;
  ok =
    pass(
      "Comments list scroll stays overflow-y auto; overlay/composer may grow",
      sheet.includes('overflowY: "auto"') &&
        styles.includes('[data-frennix-comments-sheet-body="true"]') &&
        styles.includes("overflow-y: auto !important") &&
        styles.includes('[data-frennix-comment-composer-host="true"]')
    ) && ok;
  ok =
    pass(
      "Peek geometry keeps sheetTop + sheetHeight inside the visible viewport",
      viewportLayout.includes("resolveVideoOverlayVisibleGeometry") &&
        peekGeometry.includes("resolveVideoOverlayVisibleGeometry") &&
        peekGeometry.includes("sheetTop") &&
        peekGeometry.includes("sheetHeight") &&
        sheet.includes("resolveVideoOverlayVisibleGeometry") &&
        sheet.includes("keyboardOpen")
    ) && ok;

  console.log("");
  console.log(ok ? "All checks passed." : "Some checks failed.");
  process.exit(ok ? 0 : 1);
}

main();
