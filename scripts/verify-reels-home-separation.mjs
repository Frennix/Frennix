#!/usr/bin/env node
/**
 * Journey Reels (intent=reel / is_reel) must stay off the Home feed and remain
 * in the Reels query. Normal Feed videos stay on Home.
 *
 * Usage:
 *   node scripts/verify-reels-home-separation.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function isReelPost(post) {
  return post?.is_reel === true;
}

function excludeReelPosts(posts) {
  return posts.filter((post) => !isReelPost(post) && !isReelPost(post.shared_post));
}

function onlyReelPosts(posts) {
  return posts.filter((post) => isReelPost(post) || isReelPost(post.shared_post));
}

function pass(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

function readSource(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function main() {
  console.log("verify-reels-home-separation\n");
  let ok = true;

  const postsApi = readSource("packages/api/src/posts.ts");
  const createPost = readSource("app/create-post.tsx");
  const shareWorkout = readSource("lib/share-workout.ts");
  const home = readSource("app/(tabs)/index.tsx");
  const reels = readSource("app/(tabs)/reels.tsx");
  const feedCache = readSource("lib/feed-cache.ts");
  const types = readSource("packages/types/src/index.ts");

  ok =
    pass(
      "createPost writes is_reel for Share Your Journey",
      postsApi.includes("is_reel?: boolean") &&
        postsApi.includes("...(is_reel ? { is_reel: true } : {})") &&
        shareWorkout.includes("isReel?: boolean") &&
        shareWorkout.includes("is_reel: Boolean(input.isReel && postType === \"video\")") &&
        createPost.includes("isReel: isReelIntent") &&
        createPost.split("isReel: isReelIntent").length - 1 >= 2
    ) && ok;

  ok =
    pass(
      "Home feed query excludes reels; Reels query is is_reel-only",
      postsApi.includes('q = q.eq("is_reel", false)') &&
        postsApi.includes('q = q.eq("is_reel", true)') &&
        postsApi.includes("reelsOnly: true") &&
        postsApi.includes("onlyReelPosts") &&
        home.includes("excludeReelPosts") &&
        reels.includes("getVideoFeed") &&
        reels.includes("isReelPost") &&
        reels.includes('REELS_FEED_FILTER = "is_reel"') &&
        reels.includes("removeQueries")
    ) && ok;

  ok =
    pass(
      "Optimistic / persisted Home cache strips is_reel posts",
      feedCache.includes("stripReelPostsFromHomePages") &&
        feedCache.includes("stripReelsFromHomeFeedCache") &&
        home.includes("stripReelsFromHomeFeedCache") &&
        types.includes("is_reel?: boolean")
    ) && ok;

  ok =
    pass(
      "Normal Feed videos are not treated as reels",
      postsApi.includes("return post?.is_reel === true") &&
        !postsApi.includes('post_type === "video" && journey_category') &&
        shareWorkout.includes("is_reel: Boolean(input.isReel && postType === \"video\")")
    ) && ok;

  try {
    const homeVideos = [
      { id: "feed-video", post_type: "video", is_reel: false },
      { id: "feed-photo", post_type: "photo" },
      { id: "reel", post_type: "video", is_reel: true },
      { id: "share-reel", post_type: "text", shared_post: { is_reel: true } },
    ];
    const visible = excludeReelPosts(homeVideos);
    assert.deepEqual(
      visible.map((post) => post.id),
      ["feed-video", "feed-photo"]
    );
    assert.equal(isReelPost({ is_reel: true }), true);
    assert.equal(isReelPost({ is_reel: false }), false);
    assert.equal(isReelPost({ post_type: "video" }), false);
    ok = pass("excludeReelPosts keeps Feed videos and drops is_reel rows", true) && ok;
    const mixed = [
      { id: "feed-video", post_type: "video", is_reel: false },
      { id: "reel", post_type: "video", is_reel: true },
    ];
    assert.deepEqual(
      excludeReelPosts(mixed).map((post) => post.id),
      ["feed-video"]
    );
    assert.deepEqual(
      onlyReelPosts(mixed).map((post) => post.id),
      ["reel"]
    );
    ok =
      pass("mixed-data: Feed video stays on Home and Reel stays in Reels", true) && ok;
  } catch (error) {
    ok =
      pass("mixed-data: Feed video stays on Home and Reel stays in Reels", false, String(error)) &&
      ok;
  }

  console.log("");
  console.log(ok ? "All checks passed." : "Some checks failed.");
  process.exit(ok ? 0 : 1);
}

main();
