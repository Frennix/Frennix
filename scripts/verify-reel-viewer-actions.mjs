#!/usr/bin/env node
/**
 * Reel like / respect / overlay menus / comment-count cache wiring.
 *
 * Usage:
 *   node scripts/verify-reel-viewer-actions.mjs
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
  console.log("verify-reel-viewer-actions\n");
  let ok = true;

  const postCache = readSource("lib/post-cache.ts");
  const feedLike = readSource("lib/useFeedLike.ts");
  const reaction = readSource("lib/usePostReaction.ts");
  const comments = readSource("components/PostCommentsContent.tsx");
  const commentActions = readSource("lib/useCommentActions.tsx");
  const overlay = readSource("components/ImmersiveVideoOverlayShell.tsx");
  const postActions = readSource("lib/usePostActions.tsx");
  const sharePost = readSource("lib/useSharePost.tsx");
  const shareSheet = readSource("components/SharePostSheet.tsx");
  const reels = readSource("app/(tabs)/reels.tsx");
  const viewport = readSource("lib/video-overlay-visual-viewport-layout.ts");

  ok =
    pass(
      "Reels cache is patched for likes, reactions, and comment counts",
      postCache.includes('queryKey: ["reels", userId]') &&
        postCache.includes("export function mapPostInAllCaches") &&
        postCache.includes("export function findPostInAllCaches") &&
        postCache.includes("export function adjustPostCommentCount") &&
        feedLike.includes("findPostInAllCaches") &&
        feedLike.includes("mapPostInAllCaches") &&
        reaction.includes("mapPostInAllCaches") &&
        comments.includes("adjustPostCommentCount") &&
        commentActions.includes("adjustPostCommentCount")
    ) && ok;

  ok =
    pass(
      "Like/respect read live Reel identity instead of only the Home feed cache",
      feedLike.includes("readLiked") &&
        feedLike.includes("findPostInAllCaches") &&
        !feedLike.includes('getQueryData<InfiniteData<FeedPage>>(["feed", userId])') &&
        reaction.includes("live?.my_reaction")
    ) && ok;

  ok =
    pass(
      "Viewer re-reads cache so rail counts stay live",
      overlay.includes("usePostCacheTick") &&
        overlay.includes("postCacheTick") &&
        overlay.includes("post: live")
    ) && ok;

  ok =
    pass(
      "Post options and Share portal above the Reel lightbox",
      postActions.includes("rootPortal={Platform.OS === \"web\"}") &&
        postActions.includes("frennix-post-options") &&
        sharePost.includes("rootPortal={Platform.OS === \"web\"}") &&
        sharePost.includes("frennix-share-post") &&
        shareSheet.includes("portalDataAttribute") &&
        reels.includes("resetOverlayMenus") &&
        !postActions.includes("webZIndex={999999}")
    ) && ok;

  ok =
    pass(
      "Top-level comments increment count; replies do not",
      comments.includes("if (!parentId)") &&
        comments.includes("incrementedTopLevel") &&
        commentActions.includes("decrementedTopLevel") &&
        comments.includes('queryKey: ["reels"]')
    ) && ok;

  ok =
    pass(
      "Working visualViewport / focus path is still present",
      viewport.includes("isVideoOverlayKeyboardOpen") &&
        viewport.includes("KEYBOARD_OPEN_THRESHOLD_PX = 140") &&
        readSource("components/WebCommentComposerRow.tsx").includes(
          "focus({ preventScroll: true })"
        )
    ) && ok;

  console.log("");
  console.log(ok ? "All checks passed." : "Some checks failed.");
  process.exit(ok ? 0 : 1);
}

main();
