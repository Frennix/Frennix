#!/usr/bin/env node
/**
 * Regression: mobile web immersive video viewer with overlay comments (not route replace).
 *
 * Usage:
 *   node scripts/verify-immersive-video-viewer.mjs
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
    '[data-frennix-immersive-comments-open="true"] .fullscreen-video-slide'
  );
  const immersiveSlideCss = styles.slice(
    immersiveSlideCssStart,
    commentsOpenSlideCssStart > immersiveSlideCssStart
      ? commentsOpenSlideCssStart
      : immersiveSlideCssStart + 280
  );
  const commentsOpenSlideCss = styles.slice(
    commentsOpenSlideCssStart,
    commentsOpenSlideCssStart >= 0 ? commentsOpenSlideCssStart + 220 : 0
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
        sheet.includes("VIDEO_PEEK_FRACTION")
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
        sheet.includes("videoPeekBaselineRef") &&
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
        slide.includes('objectFit: immersiveMode ? "cover" : "contain"') &&
        slide.includes('objectPosition: "center"') &&
        slide.includes('contentFit={immersiveMode ? "cover" : "contain"}')
    ) && ok;
  ok =
    pass(
      "Comments-open and non-immersive video remain contain",
      commentsOpenSlideCssStart >= 0 &&
        commentsOpenSlideCss.includes("object-fit: contain") &&
        !commentsOpenSlideCss.includes("object-fit: cover") &&
        slide.includes('objectFit: immersiveMode ? "cover" : "contain"') &&
        lightbox.includes('objectFit: "contain"')
    ) && ok;

  console.log("");
  console.log(ok ? "All checks passed." : "Some checks failed.");
  process.exit(ok ? 0 : 1);
}

main();
