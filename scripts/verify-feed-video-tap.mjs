#!/usr/bin/env node
/**
 * Regression: feed inline video uses dedicated /video/[postId] route links on mobile web.
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
  const videoRoute = readSource("lib/mobile-web-video-route.ts");

  ok =
    pass(
      "Dedicated video route module exists",
      fs.existsSync(path.join(ROOT, "app/video/[postId].tsx")) &&
        videoRoute.includes("buildVideoRouteHref") &&
        videoRoute.includes("usesMobileWebVideoRoute")
    ) && ok;
  ok =
    pass(
      "A: inline web video has pointer-events disabled",
      player.includes('className: "feed-inline-video"') &&
        player.includes('pointerEvents: "none"') &&
        styles.includes("video.feed-inline-video")
    ) && ok;
  ok =
    pass(
      "A/D: real anchor route link opens viewer via client navigation",
      player.includes("feed-video-route-link") &&
        player.includes('createElement("a"') &&
        player.includes("videoRouteHref") &&
        player.includes("event.preventDefault?.()") &&
        videoRoute.includes("navigateFromFeedVideoLink")
    ) && ok;
  ok =
    pass(
      "B: mute button stops propagation",
      player.includes("feed-video-mute-button") && player.includes("stopPropagation")
    ) && ok;
  ok =
    pass(
      "C: tap vs scroll movement threshold on route link",
      player.includes("OPEN_VIEWER_TAP_MOVE_PX") &&
        player.includes("handleRouteLinkClick") &&
        styles.includes("touch-action: pan-y")
    ) && ok;
  ok =
    pass(
      "D: expand icon is anchor with route href",
      player.includes("feed-video-expand-button") &&
        player.includes('className: "feed-video-expand-button"')
    ) && ok;
  ok =
    pass(
      "Carousel passes videoRouteHrefForIndex",
      carousel.includes("videoRouteHrefForIndex") && carousel.includes("onVideoRouteNavigate")
    ) && ok;
  ok =
    pass(
      "Mobile web bypasses overlay onVideoPress when route href set",
      carousel.includes("!videoRouteHrefForIndex")
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
