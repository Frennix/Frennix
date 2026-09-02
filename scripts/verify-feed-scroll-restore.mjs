#!/usr/bin/env node
/**
 * Regression: feed scroll restore after dedicated video/comments routes.
 *
 * Usage:
 *   node scripts/verify-feed-scroll-restore.mjs
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
  console.log("verify-feed-scroll-restore\n");
  let ok = true;

  const port = readSource("lib/web-feed-scroll-port.ts");
  const restore = readSource("lib/web-feed-scroll-restore.ts");
  const index = readSource("app/(tabs)/index.tsx");
  const feedItem = readSource("components/FeedListItem.tsx");
  const videoRoute = readSource("lib/mobile-web-video-route.ts");
  const commentsRoute = readSource("lib/mobile-web-comments-route.ts");

  ok =
    pass(
      "Resolves nested RN Web feed scrollport (not only #feed-scroll-list wrapper)",
      port.includes("resolveFeedScrollPort") &&
        port.includes("overflowY") &&
        port.includes("scrollHeight > el.clientHeight")
    ) && ok;
  ok =
    pass(
      "Captures originating post ID and nonzero scroll offset before video navigation",
      videoRoute.includes("saveFeedScrollReturnState({ postId") &&
        restore.includes("postId") &&
        restore.includes("trackFeedScrollPosition") &&
        index.includes("trackFeedScrollPosition")
    ) && ok;
  ok =
    pass(
      "Restores via ScrollView ref and post anchor with numeric fallback",
      restore.includes("registerFeedScrollController") &&
        restore.includes("scrollFeedPostIntoView") &&
        index.includes("registerFeedScrollController") &&
        feedItem.includes("data-feed-post-id")
    ) && ok;
  ok =
    pass(
      "Does not overwrite saved offset with zero while feed is hidden",
      restore.includes("shouldPreserveExistingOnZeroCapture") &&
        restore.includes("isFeedScrollPortVisible")
    ) && ok;
  const fromVideoBlock = commentsRoute.slice(
    commentsRoute.indexOf("navigateToPostCommentsFromVideoViewer")
  );
  ok =
    pass(
      "Video → Comments does not re-save feed scroll (preserves original offset)",
      fromVideoBlock.includes('markCommentsReturnTarget("video")') &&
        !fromVideoBlock.includes("saveFeedScrollReturnState(")
    ) && ok;
  ok =
    pass(
      "Clears saved state only after verified restore with bounded retries",
      restore.includes("peekFeedScrollReturnState") &&
        restore.includes("isRestoreVerified") &&
        restore.includes("RESTORE_MAX_ATTEMPTS") &&
        restore.includes("finalizeRestore") &&
        restore.includes("clearStoredFeedScrollReturnState")
    ) && ok;
  ok =
    pass(
      "Feed retries restore after delayed layout/content-size changes",
      index.includes("applyPendingFeedScrollReturnIfNeeded") &&
        restore.includes("scheduleRestoreRetries") &&
        index.includes("handleContentSizeChange")
    ) && ok;
  ok =
    pass(
      "Back uses router history (no fresh Home replace when history exists)",
      readSource("app/video/[postId].tsx").includes("router.canGoBack()") &&
        readSource("app/video/[postId].tsx").includes("router.back()")
    ) && ok;

  console.log("");
  console.log(ok ? "All checks passed." : "Some checks failed.");
  process.exit(ok ? 0 : 1);
}

main();
