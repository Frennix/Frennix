#!/usr/bin/env node
/**
 * Regression: video delivery failures surface visibly with bounded retry.
 *
 * Usage:
 *   node scripts/verify-video-media-delivery.mjs
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
  console.log("verify-video-media-delivery\n");
  let ok = true;

  const policy = readSource("packages/ui/src/videoMediaDelivery.ts");
  const feedPlayer = readSource("packages/ui/src/FeedVideoPlayer.tsx");
  const fullscreen = readSource("packages/ui/src/FullscreenVideoSlide.tsx");
  const shareWorkout = readSource("lib/share-workout.ts");

  ok =
    pass(
      "Video media policy defines first-frame timeout and single auto-retry",
      policy.includes("VIDEO_FIRST_FRAME_TIMEOUT_MS") &&
        policy.includes("VIDEO_MAX_AUTO_RETRIES = 1") &&
        policy.includes("shouldAutoRetryVideoLoad")
    ) && ok;

  ok =
    pass(
      "Media errors classify HTMLMediaElement error codes",
      policy.includes("MEDIA_ERR_NETWORK") &&
        policy.includes("MEDIA_ERR_DECODE") &&
        policy.includes("MEDIA_ERR_SRC_NOT_SUPPORTED") &&
        policy.includes("MEDIA_ERR_ABORTED")
    ) && ok;

  ok =
    pass(
      "Feed player logs failures and auto-retries once before unavailable UI",
      feedPlayer.includes("reportVideoFailure") &&
        feedPlayer.includes("shouldAutoRetryVideoLoad") &&
        feedPlayer.includes("VIDEO_FIRST_FRAME_TIMEOUT_MS") &&
        feedPlayer.includes("showLoadingPlaceholder")
    ) && ok;

  ok =
    pass(
      "Feed player declares reportVideoFailure before attemptWebAutoplay (no TDZ)",
      (() => {
        const decl = feedPlayer.indexOf("const reportVideoFailure = useCallback");
        const attempt = feedPlayer.indexOf("const attemptWebAutoplay = useCallback");
        return decl >= 0 && attempt > decl;
      })()
    ) && ok;

  ok =
    pass(
      "Feed player avoids silent black when poster is missing",
      feedPlayer.includes("loadingPlaceholder") &&
        feedPlayer.includes("showLoadingPlaceholder") &&
        feedPlayer.includes('backgroundColor: colors.surfaceElevated')
    ) && ok;

  ok =
    pass(
      "Fullscreen player uses same bounded retry and loading overlay",
      fullscreen.includes("reportVideoFailure") &&
        fullscreen.includes("showLoadingOverlay") &&
        fullscreen.includes("VIDEO_FIRST_FRAME_TIMEOUT_MS")
    ) && ok;

  ok =
    pass(
      "Upload path captures thumbnail before video upload",
      (() => {
        const fnStart = shareWorkout.indexOf("async function uploadFeedMediaAssets");
        const fnBody = shareWorkout.slice(fnStart, fnStart + 1200);
        return (
          fnBody.includes("generateAndUploadVideoThumbnail") &&
          fnBody.includes("uploadPostMedia") &&
          fnBody.indexOf("generateAndUploadVideoThumbnail") <
            fnBody.indexOf("uploadPostMedia")
        );
      })()
    ) && ok;

  ok =
    pass(
      "Diagnostics omit raw URLs from log payload",
      policy.includes("ext:") &&
        !policy.includes("publicUrl") &&
        policy.includes("logVideoMediaFailure")
    ) && ok;

  console.log(`\n${ok ? "All checks passed." : "Some checks failed."}`);
  process.exit(ok ? 0 : 1);
}

main();
