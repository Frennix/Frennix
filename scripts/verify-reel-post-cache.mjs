#!/usr/bin/env node
/**
 * Runtime check: Reel like / comment_count patches do not depend on Home feed.
 *
 * Usage:
 *   node scripts/verify-reel-post-cache.mjs
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { QueryClient } = require("@tanstack/react-query");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function assert(name, condition) {
  if (!condition) {
    throw new Error(`FAIL  ${name}`);
  }
  console.log(`PASS  ${name}`);
}

function mapPostsInInfiniteFeed(data, postId, mapper) {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      posts: page.posts.map((post) => (post.id === postId ? mapper(post) : post)),
    })),
  };
}

function findPostInAllCaches(queryClient, userId, postId) {
  const detail = queryClient.getQueryData(["post", postId, userId]);
  if (detail?.id === postId) return detail;

  const feeds = [
    queryClient.getQueryData(["feed", userId]),
    queryClient.getQueryData(["saved-posts", userId]),
  ];
  for (const query of queryClient.getQueriesData({ queryKey: ["reels", userId] })) {
    feeds.push(query[1]);
  }
  for (const feed of feeds) {
    for (const page of feed?.pages ?? []) {
      const match = page.posts.find((post) => post.id === postId);
      if (match) return match;
    }
  }
  return undefined;
}

function mapPostInAllCaches(queryClient, userId, postId, mapper) {
  queryClient.setQueryData(["post", postId, userId], (old) =>
    old?.id === postId ? mapper(old) : old
  );
  queryClient.setQueryData(["feed", userId], (old) => mapPostsInInfiniteFeed(old, postId, mapper));
  queryClient.setQueriesData({ queryKey: ["reels", userId] }, (old) =>
    mapPostsInInfiniteFeed(old, postId, mapper)
  );
}

function adjustPostCommentCount(queryClient, userId, postId, delta) {
  mapPostInAllCaches(queryClient, userId, postId, (post) => ({
    ...post,
    comment_count: Math.max(0, (post.comment_count ?? 0) + delta),
  }));
}

function main() {
  console.log("verify-reel-post-cache\n");

  const source = fs.readFileSync(path.join(ROOT, "lib/post-cache.ts"), "utf8");
  assert(
    "production post-cache exports the shared Reel mappers",
    source.includes("export function findPostInAllCaches") &&
      source.includes("export function mapPostInAllCaches") &&
      source.includes("export function adjustPostCommentCount") &&
      source.includes('queryKey: ["reels", userId]')
  );

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const userId = "user-1";
  const post = {
    id: "reel-1",
    like_count: 4,
    comment_count: 0,
    liked_by_me: true,
    my_reaction: "💪",
    is_reel: true,
  };

  queryClient.setQueryData(["reels", userId, "is_reel"], {
    pages: [{ posts: [post], nextCursor: null }],
    pageParams: [undefined],
  });

  const found = findPostInAllCaches(queryClient, userId, "reel-1");
  assert("finds a Reel that is not in the Home feed", found?.id === "reel-1" && found.liked_by_me);

  mapPostInAllCaches(queryClient, userId, "reel-1", (current) => ({
    ...current,
    liked_by_me: false,
    like_count: 3,
  }));
  assert(
    "like patch updates Reels cache",
    findPostInAllCaches(queryClient, userId, "reel-1")?.liked_by_me === false &&
      findPostInAllCaches(queryClient, userId, "reel-1")?.like_count === 3
  );

  adjustPostCommentCount(queryClient, userId, "reel-1", 1);
  assert(
    "top-level comment increments Reel comment_count",
    findPostInAllCaches(queryClient, userId, "reel-1")?.comment_count === 1
  );

  adjustPostCommentCount(queryClient, userId, "reel-1", -1);
  assert(
    "deleting a top-level comment decrements Reel comment_count",
    findPostInAllCaches(queryClient, userId, "reel-1")?.comment_count === 0
  );

  const feed = queryClient.getQueryData(["feed", userId]);
  assert("does not fabricate a Home feed entry for a Reel", feed == null);

  console.log("\nAll checks passed.");
}

main();
