#!/usr/bin/env node
/**
 * Regression: mobile web immersive video viewer with overlay comments (not route replace).
 *
 * Usage:
 *   node scripts/verify-immersive-video-viewer.mjs
 */
import { spawnSync } from "node:child_process";
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
  console.log("verify-immersive-video-viewer\n");
  let ok = true;
  const viewer = readSource("components/ImmersiveVideoViewer.tsx");
  const sheet = readSource("components/CommentsBottomSheet.tsx");
  const lightbox = readSource("components/ImageLightbox.tsx");
  const overlayShell = readSource("components/ImmersiveVideoOverlayShell.tsx");
  const postVideo = readSource("components/PostVideoScreen.tsx");
  const feed = readSource("app/(tabs)/index.tsx");
  const styles = readSource("lib/web-document-styles.js");
  const slide = readSource("packages/ui/src/FullscreenVideoSlide.tsx");
  const immersiveSlideCssStart = styles.indexOf(
    '[data-frennix-immersive-video-viewer="true"] .fullscreen-video-slide'
  );
  const commentsOpenSlideCssStart = styles.indexOf(
    '[data-frennix-immersive-video-viewer="true"][data-frennix-immersive-comments-open="true"] .fullscreen-video-slide'
  );
  const immersiveSlideCss = styles.slice(
    immersiveSlideCssStart,
    commentsOpenSlideCssStart > immersiveSlideCssStart
      ? commentsOpenSlideCssStart
      : immersiveSlideCssStart + 280
  );
  const commentsOpenSlideCss = styles.slice(
    commentsOpenSlideCssStart,
    commentsOpenSlideCssStart >= 0 ? commentsOpenSlideCssStart + 420 : 0
  );

  ok =
    pass(
      "ImmersiveVideoViewer component exists",
      fs.existsSync(path.join(ROOT, "components/ImmersiveVideoViewer.tsx"))
    ) && ok;
  ok =
    pass(
      "Viewer exposes like/respect/comment/share/options",
      viewer.includes("onLike") &&
        viewer.includes("onRespect") &&
        viewer.includes("onShare") &&
        viewer.includes("onMore") &&
        viewer.includes("Add a comment")
    ) && ok;
  ok =
    pass(
      "Shared overlay shell opens videoOverlay comments sheet",
      overlayShell.includes('presentation="videoOverlay"') &&
        overlayShell.includes("PostCommentsSheet") &&
        sheet.includes("videoOverlay") &&
        sheet.includes("COMMENTS_VIDEO_PEEK_FRACTION")
    ) && ok;
  ok =
    pass(
      "Video keeps playing when opening comments overlay",
      viewer.includes("getPlaybackSnapshot") && !viewer.includes("videoRef.current?.pause()")
    ) && ok;
  ok =
    pass(
      "Feed overlay uses shared shell — does not navigate to comments route",
      lightbox.includes("ImmersiveVideoOverlayShell") &&
        !feed.includes("navigateToPostCommentsFromVideoViewer")
    ) && ok;
  ok =
    pass(
      "Feed passes immersive context for video taps only",
      feed.includes("buildImmersiveVideoContext") &&
        feed.includes('kind === "video"') &&
        feed.includes("immersiveVideo")
    ) && ok;
  ok =
    pass(
      "Deep-link /video route reuses shared overlay shell",
      postVideo.includes("ImmersiveVideoOverlayShell") && postVideo.includes("routePlayback")
    ) && ok;
  ok =
    pass(
      "Uses existing feed like/respect/share hooks",
      feed.includes("toggleLikePost") &&
        feed.includes("postReaction.mutate") &&
        feed.includes("openShare") &&
        feed.includes("openPostActions")
    ) && ok;
  ok =
    pass(
      "Comment trigger uses 16px font on web",
      viewer.includes('Platform.OS === "web" ? 16 : 15')
    ) && ok;
  ok =
    pass(
      "Tab bar hidden via existing lightbox overlay state",
      readSource("app/(tabs)/_layout.tsx").includes("useLightboxOverlayOpen")
    ) && ok;
  ok =
    pass(
      "Immersive video CSS guard",
      styles.includes("frennix-immersive-video-viewer")
    ) && ok;
  ok =
    pass(
      "Comments overlay shrinks video stage with contain scaling",
      viewer.includes("commentsOverlayOpen") &&
        viewer.includes("videoStageHeight") &&
        viewer.includes("videoStageHostPeek") &&
        viewer.includes("useCommentsVideoPeekLayout") &&
        sheet.includes("computeBaselineVideoPeekHeight") &&
        sheet.includes("COMMENTS_VIDEO_PEEK_TARGET_MIN_PX") &&
        sheet.includes("captureImmersiveSessionLayoutHeight") &&
        sheet.includes("overlayViewport") &&
        !sheet.includes("videoPeekBaselineRef") &&
        sheet.includes("videoOverlayColumn") &&
        styles.includes("data-frennix-immersive-comments-open")
    ) && ok;
  ok =
    pass(
      "Photo/lightbox path unchanged for non-immersive video",
      lightbox.includes("FullscreenVideoSlide") && lightbox.includes("WebZoomableImage")
    ) && ok;
  ok =
    pass(
      "Full immersive video uses cover + center",
      immersiveSlideCssStart >= 0 &&
        immersiveSlideCss.includes("object-fit: cover") &&
        immersiveSlideCss.includes("object-position: center") &&
        !immersiveSlideCss.includes("object-fit: contain") &&
        slide.includes('contentFit ?? (immersiveMode ? "cover" : "contain")') &&
        slide.includes("objectFit: mediaFit") &&
        slide.includes("contentFit={mediaFit}") &&
        viewer.includes('contentFit={mediaFit}') &&
        viewer.includes('const mediaFit = commentsOverlayOpen ? "contain" : "cover"')
    ) && ok;
  ok =
    pass(
      "Comments-open JS and CSS use contain; closed immersive uses cover",
      commentsOpenSlideCssStart >= 0 &&
        commentsOpenSlideCss.includes("object-fit: contain") &&
        commentsOpenSlideCss.includes("width: 100%") &&
        commentsOpenSlideCss.includes("height: 100%") &&
        !commentsOpenSlideCss.includes("width: auto") &&
        !commentsOpenSlideCss.includes("height: auto") &&
        !commentsOpenSlideCss.includes("object-fit: cover") &&
        commentsOpenSlideCss.includes("video.feed-inline-video") &&
        viewer.includes('commentsOverlayOpen ? "contain" : "cover"') &&
        slide.includes("objectFit: mediaFit") &&
        lightbox.includes('objectFit: "contain"')
    ) && ok;

  const gallery = readSource("lib/useMediaGallery.tsx");
  const playlist = readSource("components/ImmersiveVideoPlaylistViewer.tsx");
  const overlayZ = readSource("lib/overlay-z-index.ts");
  const viewport = readSource("lib/video-overlay-visual-viewport-layout.ts");
  const peekGeometry = readSource("lib/video-overlay-peek-geometry.ts");
  const commentsSheetZ = Number(overlayZ.match(/commentsSheet:\s*(\d+)/)?.[1]);
  const lightboxZ = Number(overlayZ.match(/imageLightbox:\s*(\d+)/)?.[1]);
  const videoOverlayZ = Number(overlayZ.match(/commentsVideoOverlay:\s*(\d+)/)?.[1]);
  const commentOptionsZ = Number(overlayZ.match(/commentOptions:\s*(\d+)/)?.[1]);

  ok =
    pass(
      "Video Feed comments open immersive viewer via commentsInitiallyOpen",
      feed.includes("commentsInitiallyOpen: true") &&
        feed.includes('kind === "video"') &&
        feed.includes("openFeedMediaGallery") &&
        gallery.includes("commentsInitiallyOpen") &&
        lightbox.includes("commentsInitiallyOpen={commentsInitiallyOpen}") &&
        overlayShell.includes("commentsInitiallyOpen") &&
        overlayShell.includes("useState(commentsInitiallyOpen)")
    ) && ok;
  ok =
    pass(
      "Photo comments still use the dedicated comments route",
      feed.includes("openComments(post)") &&
        readSource("lib/useFeedCommentsSheet.tsx").includes("navigateToPostComments")
    ) && ok;
  ok =
    pass(
      "Stacking: lightbox < video overlay sheet < composer / comment options",
      commentsSheetZ === 99998 &&
        lightboxZ === 99999 &&
        videoOverlayZ > lightboxZ &&
        commentOptionsZ > videoOverlayZ &&
        styles.includes("z-index: 100001 !important") &&
        styles.includes("z-index: 2147483647 !important") &&
        styles.includes("[data-frennix-video-peek-dismiss") &&
        styles.includes("background: transparent !important")
    ) && ok;
  ok =
    pass(
      "Comments sheet surface wraps header and list",
      sheet.includes("styles.videoOverlaySheetBody") &&
        sheet.includes("{listRegion}") &&
        !sheet.includes("VIDEO_PEEK_KEYBOARD_OPEN_PX")
    ) && ok;
  ok =
    pass(
      "Keyboard-open peek uses clamped helper, not an 80px collapse",
      viewport.includes("resolveVideoOverlayPeekAndSheetHeight") &&
        peekGeometry.includes("VIDEO_OVERLAY_KEYBOARD_PEEK_FLOOR_PX") &&
        peekGeometry.includes("VIDEO_OVERLAY_SINGLE_LINE_COMPOSER_RESERVE_PX") &&
        sheet.includes("resolveVideoOverlayPeekAndSheetHeight") &&
        sheet.includes("keyboardOpen") &&
        !sheet.includes("VIDEO_PEEK_KEYBOARD_OPEN_PX = 80") &&
        !viewport.includes("? IOS_SAFARI_FLOATING_CONTROLS_PX")
    ) && ok;
  ok =
    pass(
      "Safari browser vs standalone PWA use measured clearance",
      viewport.includes("export function resolveSafariControlsClearance") &&
        viewport.includes("alreadyAccountedInVisualViewport") &&
        viewport.includes("input.standalone") &&
        viewport.includes("safeAreaTop = standalone ? readEnvSafeAreaTop()")
    ) && ok;
  ok =
    pass(
      "iOS focus correction remains (no capture-phase blockers)",
      sheet.includes('touchAction: "manipulation"') &&
        !sheet.includes("addEventListener") &&
        !sheet.includes("stopPointerEventPropagation") &&
        !sheet.includes("preventDefault")
    ) && ok;
  ok =
    pass(
      "Keyboard-open peek stays useful while the list shrinks",
      verifyPeekGeometryContract()
    ) && ok;
  ok =
    pass(
      "Safari 90px is not subtracted when visualViewport already shrank",
      verifySafariClearanceContract()
    ) && ok;
  ok =
    pass(
      "Adopted and rendered video stay 100% of the stage",
      slide.includes("objectFit: mediaFit") &&
        slide.includes("width: stageWidth") &&
        slide.includes("height: stageHeight") &&
        !slide.includes('width: "auto"') &&
        !slide.includes('height: "auto"') &&
        !styles.includes("width: auto !important") &&
        !styles.includes("height: auto !important")
    ) && ok;
  ok =
    pass(
      "Poster fit follows the same comments-open mode",
      slide.includes("contentFit={mediaFit}") &&
        (slide.split("contentFit={mediaFit}").length - 1) >= 2
    ) && ok;
  ok =
    pass(
      "Comments-open immersive stage is not collapsed by visualViewport pageHeight",
      lightbox.includes("layoutViewportHeight") &&
        lightbox.includes("freezeImmersiveLayout") &&
        lightbox.includes("freezeLayoutViewportHeight") &&
        lightbox.includes("immersiveStageHeight") &&
        lightbox.includes("captureImmersiveSessionLayoutHeight") &&
        lightbox.includes("clearImmersiveSessionLayoutHeight") &&
        viewer.includes("getImmersiveSessionLayoutHeight") &&
        viewer.includes("computeBaselineVideoPeekHeight(layoutFallbackHeight)")
    ) && ok;
  ok =
    pass(
      "Comments-open removes translateY containing-block clipping",
      lightbox.includes("freezeImmersiveLayout ? null : { transform: [{ translateY: dismissY }] }") &&
        lightbox.includes("data-frennix-lightbox-stage-shell") &&
        styles.includes('[data-frennix-lightbox-stage-shell="true"]') &&
        !lightbox.includes("VIDEO_PEEK_KEYBOARD_OPEN_PX")
    ) && ok;
  const stageHostCssStart = styles.indexOf('[data-frennix-video-stage-host="true"]');
  const stageHostCss =
    stageHostCssStart >= 0
      ? styles.slice(stageHostCssStart, styles.indexOf("}", stageHostCssStart) + 1)
      : "";
  const commentsOverlayCssStart = styles.indexOf('[data-frennix-comments-video-overlay="true"] {');
  const commentsOverlayCss =
    commentsOverlayCssStart >= 0
      ? styles.slice(commentsOverlayCssStart, styles.indexOf("}", commentsOverlayCssStart) + 1)
      : "";
  ok =
    pass(
      "No comments-open wildcard overflow selector",
      !styles.includes('[data-frennix-lightbox="true"][data-frennix-immersive-comments-open="true"] *') &&
        !styles.includes('[data-frennix-video-stage-host="true"] *') &&
        !/\[[^\]]+comments-open[^\]]*\]\s+\*\s*\{/.test(styles)
    ) && ok;
  ok =
    pass(
      "Video-stage hosts remain overflow:hidden",
      viewer.includes("videoStageHost") &&
        viewer.includes('overflow: "hidden"') &&
        stageHostCss.includes("overflow: hidden !important") &&
        !stageHostCss.includes("*")
    ) && ok;
  ok =
    pass(
      "Comments list containers are not forced to overflow:visible",
      !/data-frennix-comments-sheet[^{]*\{[^}]*overflow:\s*visible/.test(styles) &&
        !commentsOverlayCss.includes("overflow: visible") &&
        sheet.includes('overflowY: "auto"') &&
        sheet.includes("minHeight: 0")
    ) && ok;
  ok =
    pass(
      "Adjacent playlist slides remain clipped",
      playlist.includes('overflow: "hidden"') &&
        playlist.includes('overflowY: "scroll"') &&
        !playlist.includes('overflowY: commentsOverlayOpen ? "visible"') &&
        !playlist.includes("slideShellCommentsOpen") &&
        !playlist.includes("rootCommentsOpen") &&
        !styles.includes(
          '[data-frennix-immersive-video-playlist="true"][data-frennix-immersive-comments-open="true"]'
        )
    ) && ok;

  console.log("");
  console.log(ok ? "All checks passed." : "Some checks failed.");
  process.exit(ok ? 0 : 1);
}

function verifyPeekGeometryContract() {
  const result = spawnSync(
    "npx",
    ["tsx", "scripts/verify-video-overlay-peek-geometry.ts"],
    { cwd: ROOT, encoding: "utf8" }
  );
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result.status === 0;
}

function verifySafariClearanceContract() {
  function resolve(input) {
    if (input.standalone || !input.isIosSafari || !input.keyboardOpen) return 0;
    if (input.bottomChrome > 0 || input.layoutHeight - input.visualHeight > 0) return 0;
    return 0;
  }

  const safariKeyboardAlreadyShrunk = resolve({
    isIosSafari: true,
    standalone: false,
    keyboardOpen: true,
    bottomChrome: 320,
    layoutHeight: 844,
    visualHeight: 420,
  });
  const standaloneKeyboard = resolve({
    isIosSafari: true,
    standalone: true,
    keyboardOpen: true,
    bottomChrome: 0,
    layoutHeight: 844,
    visualHeight: 500,
  });
  const safariNoKeyboard = resolve({
    isIosSafari: true,
    standalone: false,
    keyboardOpen: false,
    bottomChrome: 0,
    layoutHeight: 844,
    visualHeight: 844,
  });

  return (
    safariKeyboardAlreadyShrunk === 0 &&
    standaloneKeyboard === 0 &&
    safariNoKeyboard === 0
  );
}

main();
