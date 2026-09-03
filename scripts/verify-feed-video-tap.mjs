#!/usr/bin/env node
/**
 * Regression: feed inline video opens immersive overlay directly on mobile web.
 *
 * Usage:
 *   node scripts/verify-feed-video-tap.mjs
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
  console.log("verify-feed-video-tap\n");
  let ok = true;
  const player = readSource("packages/ui/src/FeedVideoPlayer.tsx");
  const styles = readSource("lib/web-document-styles.js");
  const carousel = readSource("packages/ui/src/PostMediaCarousel.tsx");
  const feedIndex = readSource("app/(tabs)/index.tsx");
  const lightbox = readSource("components/ImageLightbox.tsx");
  const videoRoute = readSource("lib/mobile-web-video-route.ts");

  ok =
    pass(
      "Dedicated video route module exists for direct links",
      fs.existsSync(path.join(ROOT, "app/video/[postId].tsx")) &&
        videoRoute.includes("buildVideoRouteHref")
    ) && ok;
  ok =
    pass(
      "Home feed opens immersive overlay instead of video route navigation",
      feedIndex.includes("buildImmersiveVideoContext") &&
        feedIndex.includes("openGallery(") &&
        !feedIndex.includes("videoRouteHrefForMedia:") &&
        !feedIndex.includes("onVideoRouteNavigate:")
    ) && ok;
  ok =
    pass(
      "A: inline web video has pointer-events disabled",
      player.includes("feed-inline-video") &&
        player.includes('pointerEvents: "none"') &&
        styles.includes("video.feed-inline-video")
    ) && ok;
  ok =
    pass(
      "Feed video tap uses overlay hit layer when route href is absent",
      player.includes("feed-video-open-hit-layer") &&
        player.includes("onOpenFullscreen") &&
        carousel.includes("onVideoPress") &&
        carousel.includes("!videoRouteHrefForIndex")
    ) && ok;
  ok =
    pass(
      "B: mute button stops propagation",
      player.includes("feed-video-mute-button") && player.includes("stopPropagation")
    ) && ok;
  ok =
    pass(
      "Mobile web lightbox mounts immersive viewer with post actions",
      lightbox.includes("useImmersiveVideo") &&
        lightbox.includes("ImmersiveVideoViewer") &&
        lightbox.includes("createPortal")
    ) && ok;
  ok =
    pass(
      "Fullscreen slide shows poster overlay while buffering",
      readSource("packages/ui/src/FullscreenVideoSlide.tsx").includes("showPosterOverlay")
    ) && ok;
  ok =
    pass(
      "Opaque video route CSS guard",
      styles.includes("frennix-video-route") && styles.includes("min-height: 100dvh")
    ) && ok;
  ok =
    pass(
      "Video route counts as authenticated startup destination",
      readSource("lib/boot-shell-document.js").includes('["frennix-video-route", 120]') &&
        readSource("lib/authenticated-startup-ready.ts").includes('"frennix-video-route"')
    ) && ok;

  console.log("");
  console.log(ok ? "All checks passed." : "Some checks failed.");
  process.exit(ok ? 0 : 1);
}

main();
