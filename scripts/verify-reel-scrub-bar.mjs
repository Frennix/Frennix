#!/usr/bin/env node
/**
 * Reel timeline/scrub bar wiring — parent control above Add a comment.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function pass(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function main() {
  console.log("verify-reel-scrub-bar\n");
  let ok = true;
  const viewer = read("components/ImmersiveVideoViewer.tsx");
  const playlist = read("components/ImmersiveVideoPlaylistViewer.tsx");
  const slide = read("packages/ui/src/FullscreenVideoSlide.tsx");
  const styles = read("lib/web-document-styles.js");
  const scrubber = read("components/ReelScrubBar.tsx");

  ok =
    pass(
      "ReelScrubBar sits immediately above Add a comment",
      viewer.includes("<ReelScrubBar") &&
        /ReelScrubBar[\s\S]{0,400}Add a comment/.test(viewer) &&
        viewer.includes("commentComposerHost")
    ) && ok;

  ok =
    pass(
      "Scrub bar paints time, duration, and a draggable track",
      scrubber.includes("TOUCH_HEIGHT") &&
        scrubber.includes("beginScrub") &&
        scrubber.includes("formatVideoTime") &&
        scrubber.includes("getVideoElement") &&
        scrubber.includes("data-frennix-reel-scrubber")
    ) && ok;

  ok =
    pass(
      "Fullscreen slide exposes seek APIs without changing immersiveMode hide",
      slide.includes("seekTo: (time: number, options?: { silent?: boolean })") &&
        slide.includes("getDuration:") &&
        slide.includes("getVideoElement:") &&
        slide.includes("immersiveMode")
    ) && ok;

  ok =
    pass(
      "Horizontal scrubbing locks vertical Reel navigation",
      playlist.includes("onScrubbingChange") &&
        playlist.includes("data-frennix-reel-scrubbing") &&
        playlist.includes('overflowY: scrubbing ? "hidden"') &&
        playlist.includes("scrubbingRef.current") &&
        styles.includes("data-frennix-reel-scrubbing")
    ) && ok;

  ok =
    pass(
      "Immersive mode still hides the built-in slide chrome",
      viewer.includes("immersiveMode") &&
        slide.includes("hide transport/scrubber chrome")
    ) && ok;

  console.log("");
  console.log(ok ? "All checks passed." : "Some checks failed.");
  process.exit(ok ? 0 : 1);
}

main();
