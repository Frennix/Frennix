#!/usr/bin/env node
/**
 * Reel scrubber must follow the finger via rAF/refs, not full-Reel React updates.
 *
 * Usage:
 *   node scripts/verify-reel-scrub-smooth.mjs
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
  console.log("verify-reel-scrub-smooth\n");
  let ok = true;
  const scrubber = readSource("components/ReelScrubBar.tsx");
  const viewer = readSource("components/ImmersiveVideoViewer.tsx");
  const playlist = readSource("components/ImmersiveVideoPlaylistViewer.tsx");
  const slide = readSource("packages/ui/src/FullscreenVideoSlide.tsx");
  const styles = readSource("lib/web-document-styles.js");

  ok =
    pass(
      "Live scrub paints through refs and requestAnimationFrame",
      scrubber.includes("requestAnimationFrame") &&
        scrubber.includes("paintScrubber") &&
        scrubber.includes("targetTimeRef") &&
        scrubber.includes("fillElRef") &&
        scrubber.includes("thumbElRef") &&
        !/setIdleCurrentTime\(nextTime\)/.test(
          scrubber.slice(scrubber.indexOf("const flushLiveSeek"), scrubber.indexOf("const beginScrub"))
        )
    ) && ok;

  ok =
    pass(
      "Video seeks are throttled while dragging; release performs one exact seek",
      scrubber.includes("SEEK_THROTTLE_MS") &&
        scrubber.includes("flushLiveSeek(false)") &&
        scrubber.includes("flushLiveSeek(true)") &&
        scrubber.includes("fastSeek")
    ) && ok;

  ok =
    pass(
      "Silent slide seeks do not rerender the Reel on every move",
      slide.includes("options?: { silent?: boolean }") &&
        slide.includes("video.fastSeek") &&
        /if \(options\?\.silent\) \{[\s\S]*return;/.test(slide)
    ) && ok;

  ok =
    pass(
      "Canvas thumbnail preview is disabled during drag",
      !scrubber.includes("toDataURL") &&
        !scrubber.includes("drawImage") &&
        !scrubber.includes("PREVIEW_WIDTH")
    ) && ok;

  ok =
    pass(
      "Horizontal lock + pointer capture happen after a horizontal gesture",
      scrubber.includes("HORIZONTAL_LOCK_PX") &&
        scrubber.includes("setPointerCapture") &&
        scrubber.includes("data-frennix-reel-scrub-locked") &&
        styles.includes('data-frennix-reel-scrub-locked="true"') &&
        styles.includes("touch-action: pan-y")
    ) && ok;

  ok =
    pass(
      "Playback pauses on scrub start and resumes only if it was playing",
      scrubber.includes("wasPlayingRef") &&
        scrubber.includes("videoRef.current?.pause()") &&
        scrubber.includes("if (wasPlayingRef.current)")
    ) && ok;

  ok =
    pass(
      "Scrubber row stays above Add a comment without overlaying the caption",
      viewer.includes("data-frennix-reel-bottom-chrome") &&
        viewer.includes("CAPTION_COLLAPSE_LINES") &&
        /ReelScrubBar[\s\S]*Add a comment/.test(viewer) &&
        !viewer.includes("paddingBottom: bottomInset + 58")
    ) && ok;

  ok =
    pass(
      "Playlist vertical navigation locks only after onScrubbingChange(true)",
      playlist.includes("onScrubbingChange={isActive ? setScrubbing : undefined}") &&
        playlist.includes('overflowY: scrubbing ? "hidden"')
    ) && ok;

  console.log("");
  console.log(ok ? "All checks passed." : "Some checks failed.");
  process.exit(ok ? 0 : 1);
}

main();
