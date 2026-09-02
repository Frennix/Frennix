#!/usr/bin/env node
/**
 * Regression: mobile web immersive video viewer with social actions + comments route.
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
  const feed = readSource("app/(tabs)/index.tsx");
  const returnState = readSource("lib/web-video-viewer-return.ts");
  const commentsRoute = readSource("lib/mobile-web-comments-route.ts");
  const styles = readSource("lib/web-document-styles.js");

  ok = pass("ImmersiveVideoViewer component exists", fs.existsSync(path.join(ROOT, "components/ImmersiveVideoViewer.tsx"))) && ok;
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
      "Comment opens overlay sheet on mobile web video route",
      readSource("components/PostVideoScreen.tsx").includes('presentation="videoOverlay"') &&
        readSource("components/CommentsBottomSheet.tsx").includes('videoOverlay') &&
        readSource("components/CommentsBottomSheet.tsx").includes("VIDEO_PEEK_FRACTION")
    ) && ok;
  ok =
    pass(
      "Video keeps playing when opening comments overlay",
      viewer.includes("getPlaybackSnapshot") &&
        !viewer.includes("videoRef.current?.pause()") &&
        commentsRoute.includes("navigateToPostCommentsFromVideoViewer")
    ) && ok;
  ok =
    pass(
      "ImageLightbox uses ImmersiveVideoViewer on mobile web",
      lightbox.includes("ImmersiveVideoViewer") && lightbox.includes("useImmersiveVideo")
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
      "Dedicated video route keeps viewer mounted under comments overlay",
      readSource("components/PostVideoScreen.tsx").includes("ImmersiveVideoViewer") &&
        readSource("components/PostVideoScreen.tsx").includes("PostCommentsSheet")
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
      "Video route uses comments overlay instead of fullscreen comments route",
      readSource("components/PostVideoScreen.tsx").includes("openCommentsOverlay") &&
        readSource("components/PostVideoScreen.tsx").includes("usesMobileWebCommentsRoute")
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

  console.log("");
  console.log(ok ? "All checks passed." : "Some checks failed.");
  process.exit(ok ? 0 : 1);
}

main();
