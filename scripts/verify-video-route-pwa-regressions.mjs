#!/usr/bin/env node
/**
 * Regression: iPhone PWA video — overlay-first feed, deep-link /video route, scroll restore.
 *
 * Usage:
 *   node scripts/verify-video-route-pwa-regressions.mjs
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
  console.log("verify-video-route-pwa-regressions\n");
  let ok = true;

  const slide = readSource("packages/ui/src/FullscreenVideoSlide.tsx");
  const overlayShell = readSource("components/ImmersiveVideoOverlayShell.tsx");
  const postVideoScreen = readSource("components/PostVideoScreen.tsx");
  const buildContext = readSource("lib/useBuildImmersiveVideoContext.ts");
  const route = readSource("app/video/[postId].tsx");
  const scrollRestore = readSource("lib/web-feed-scroll-restore.ts");
  const index = readSource("app/(tabs)/index.tsx");
  const styles = readSource("lib/web-document-styles.js");
  const immersive = readSource("components/ImmersiveVideoViewer.tsx");

  ok =
    pass(
      "A: feed opens overlay — not client /video navigation",
      index.includes("openGallery(") &&
        index.includes("immersiveVideoPlaylist") &&
        !index.includes("navigateFromFeedVideoLink") &&
        !index.includes("videoRouteHrefForMedia")
    ) && ok;
  ok =
    pass(
      "A: /video deep links still supported for direct loads",
      readSource("lib/mobile-web-video-route.ts").includes("buildVideoRouteHref") &&
        route.includes("PostVideoScreen")
    ) && ok;
  ok =
    pass(
      "B: route video decoupled from feed autoplay coordinator",
      slide.includes("routePlayback") &&
        postVideoScreen.includes("routePlayback") &&
        overlayShell.includes("routePlayback")
    ) && ok;
  ok =
    pass(
      "C: Share and More sheets mount on video route via build context hook",
      postVideoScreen.includes("shareSheet") &&
        postVideoScreen.includes("postActionSheets") &&
        buildContext.includes("shareSheet") &&
        buildContext.includes("postActionSheets")
    ) && ok;
  ok =
    pass(
      "C: immersive action rail receives pointer events",
      immersive.includes("data-frennix-immersive-rail") &&
        styles.includes("data-frennix-immersive-rail")
    ) && ok;
  ok =
    pass(
      "D: scroll restore deferred until feed list is ready",
      scrollRestore.includes("pendingRestore") &&
        scrollRestore.includes("applyPendingFeedScrollReturnIfNeeded") &&
        index.includes("applyPendingFeedScrollReturnIfNeeded")
    ) && ok;
  ok =
    pass(
      "D: overlay close scrolls feed to active post",
      scrollRestore.includes("scrollFeedToPost") && index.includes("scrollFeedToPost")
    ) && ok;
  ok =
    pass(
      "D: /video back requests feed scroll restore",
      route.includes("requestFeedScrollReturnRestore")
    ) && ok;
  ok =
    pass(
      "Comments overlay on /video route — no fullscreen comments navigation",
      overlayShell.includes('presentation="videoOverlay"') &&
        !postVideoScreen.includes("navigateToPostCommentsFromVideoViewer")
    ) && ok;
  ok =
    pass(
      "Direct /video/[postId] session reuse unchanged",
      route.includes("useAuth()") && route.includes("frennix-video-route")
    ) && ok;

  console.log("");
  console.log(ok ? "All checks passed." : "Some checks failed.");
  process.exit(ok ? 0 : 1);
}

main();
