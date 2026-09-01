#!/usr/bin/env node
/**
 * Regression: feed inline video tap opens immersive viewer on iPhone web/PWA.
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

  ok =
    pass(
      "A: inline web video has pointer-events disabled",
      player.includes('className: "feed-inline-video"') &&
        player.includes('pointerEvents: "none"') &&
        styles.includes("video.feed-inline-video")
    ) && ok;
  ok =
    pass(
      "A/D: dedicated transparent hit layer opens viewer",
      player.includes("feed-video-open-hit-layer") &&
        player.includes("openViewer") &&
        player.includes("onPointerUp")
    ) && ok;
  ok =
    pass(
      "B: mute button stops propagation",
      player.includes("feed-video-mute-button") && player.includes("stopPropagation")
    ) && ok;
  ok =
    pass(
      "C: tap vs scroll movement threshold",
      player.includes("OPEN_VIEWER_TAP_MOVE_PX") &&
        player.includes("Math.hypot") &&
        player.includes('touchAction: "pan-y"')
    ) && ok;
  ok =
    pass(
      "D: expand icon entry point",
      player.includes("feed-video-expand-button") && player.includes("Maximize2")
    ) && ok;
  ok =
    pass(
      "Carousel wires onVideoPress to onMediaPress",
      carousel.includes("onVideoPress") && carousel.includes("onMediaPress")
    ) && ok;
  ok =
    pass(
      "Hit layer sits above video, below control buttons",
      player.includes("zIndex: 2") && player.includes("zIndex: 101")
    ) && ok;
  ok =
    pass(
      "No preventDefault on open tap handlers",
      !player.includes("preventDefault") || !player.match(/handleWebOpen[\s\S]*preventDefault/)
    ) && ok;

  console.log("");
  console.log(ok ? "All checks passed." : "Some checks failed.");
  process.exit(ok ? 0 : 1);
}

main();
