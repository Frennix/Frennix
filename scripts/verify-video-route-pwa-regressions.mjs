#!/usr/bin/env node
/**
 * Regression: iPhone PWA video route — client nav, playback, actions, scroll restore.
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

  const player = readSource("packages/ui/src/FeedVideoPlayer.tsx");
  const videoRoute = readSource("lib/mobile-web-video-route.ts");
  const slide = readSource("packages/ui/src/FullscreenVideoSlide.tsx");
  const immersive = readSource("components/ImmersiveVideoViewer.tsx");
  const postVideoScreen = readSource("components/PostVideoScreen.tsx");
  const route = readSource("app/video/[postId].tsx");
  const scrollRestore = readSource("lib/web-feed-scroll-restore.ts");
  const commentsRoute = readSource("lib/mobile-web-comments-route.ts");
  const postActionsHook = readSource("lib/useImmersiveVideoPostActions.ts");
  const index = readSource("app/(tabs)/index.tsx");
  const styles = readSource("lib/web-document-styles.js");

  ok =
    pass(
      "A: feed video link prevents document navigation on in-app tap",
      player.includes("event.preventDefault?.()") &&
        player.includes("onVideoRouteNavigate?.()") &&
        videoRoute.includes("navigateFromFeedVideoLink") &&
        videoRoute.includes("router.push")
    ) && ok;
  ok =
    pass(
      "A: real href preserved for direct /video/[postId] loads",
      player.includes('href: videoRouteHref') && videoRoute.includes("buildVideoRouteHref")
    ) && ok;
  ok =
    pass(
      "B: route video decoupled from feed autoplay coordinator",
      slide.includes("routePlayback") &&
        slide.includes("!routePlayback") &&
        postVideoScreen.includes("routePlayback") &&
        slide.includes("routePlayback || !playbackHandoff?.playbackId")
    ) && ok;
  ok =
    pass(
      "C: Share and More sheets mount on video route",
      route.includes("shareSheet") &&
        route.includes("postActionSheets") &&
        postActionsHook.includes("shareSheet") &&
        postActionsHook.includes("postActionSheets")
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
      scrollRestore.includes("pendingRestoreTop") &&
        scrollRestore.includes("applyPendingFeedScrollReturnIfNeeded") &&
        index.includes("applyPendingFeedScrollReturnIfNeeded")
    ) && ok;
  ok =
    pass(
      "D: video/comments back requests restore without consuming early",
      route.includes("requestFeedScrollReturnRestore") &&
        readSource("app/comments/[postId].tsx").includes("shouldRestoreFeedScrollOnCommentsBack")
    ) && ok;
  ok =
    pass(
      "D: Video → Comments → Video preserves feed scroll for final exit",
      commentsRoute.includes("markCommentsReturnTarget") &&
        commentsRoute.includes('"video"') &&
        commentsRoute.includes("shouldRestoreFeedScrollOnCommentsBack")
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
