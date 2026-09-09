import assert from "node:assert/strict";
import { QueryClient } from "@tanstack/react-query";
import type { FeedPage, Post } from "../packages/types/src/index.ts";
import {
  prependReelToReelsPages,
  prependReelToReelsQuery,
} from "../lib/reels-cache.ts";

function post(partial: Partial<Post> & Pick<Post, "id" | "post_type">): Post {
  return {
    author_id: "author",
    content: "",
    media_urls: ["https://example.com/video.mp4"],
    created_at: "2026-09-09T00:00:00.000Z",
    is_reel: false,
    ...partial,
  } as Post;
}

function main() {
  const existing = post({ id: "older-reel", post_type: "video", is_reel: true });
  const created = post({ id: "new-reel", post_type: "video", is_reel: true, content: "journey" });
  const pages: FeedPage[] = [
    { posts: [existing, created], nextCursor: "cursor-1" },
    { posts: [created], nextCursor: null },
  ];

  const prepended = prependReelToReelsPages(pages, created);
  assert.equal(prepended[0]?.posts[0]?.id, "new-reel");
  assert.equal(prepended[0]?.posts.filter((item) => item.id === "new-reel").length, 1);
  assert.equal(
    prepended.flatMap((page) => page.posts).filter((item) => item.id === "new-reel").length,
    1
  );
  assert.equal(prepended[0]?.posts[1]?.id, "older-reel");

  const seeded = prependReelToReelsPages(undefined, created);
  assert.equal(seeded.length, 1);
  assert.equal(seeded[0]?.posts[0]?.id, "new-reel");
  assert.equal(seeded[0]?.posts[0]?.is_reel, true);

  const photoIgnored = prependReelToReelsPages(
    [{ posts: [existing], nextCursor: null }],
    post({ id: "photo", post_type: "photo", is_reel: false })
  );
  assert.equal(photoIgnored[0]?.posts.length, 1);
  assert.equal(photoIgnored[0]?.posts[0]?.id, "older-reel");

  const queryClient = new QueryClient();
  const userId = "user-1";
  const feedPost = post({ id: "feed-video", post_type: "video", is_reel: false });
  queryClient.setQueryData(["feed", userId], {
    pages: [{ posts: [feedPost], nextCursor: null }],
    pageParams: [undefined],
  });
  queryClient.setQueryData(["reels", userId], {
    pages: [{ posts: [existing], nextCursor: null }],
    pageParams: [undefined],
  });

  prependReelToReelsQuery(queryClient, userId, created);
  prependReelToReelsQuery(queryClient, userId, created);

  const reels = queryClient.getQueryData<{ pages: FeedPage[] }>(["reels", userId]);
  const feed = queryClient.getQueryData<{ pages: FeedPage[] }>(["feed", userId]);
  const reelIds = reels?.pages.flatMap((page) => page.posts.map((item) => item.id)) ?? [];

  assert.deepEqual(reelIds, ["new-reel", "older-reel"]);
  assert.equal(feed?.pages[0]?.posts[0]?.id, "feed-video");
  assert.equal(feed?.pages[0]?.posts.some((item) => item.id === "new-reel"), false);

  prependReelToReelsQuery(
    queryClient,
    userId,
    post({ id: "not-a-reel-photo", post_type: "photo", is_reel: true })
  );
  const reelsAfterPhoto = queryClient.getQueryData<{ pages: FeedPage[] }>(["reels", userId]);
  assert.deepEqual(
    reelsAfterPhoto?.pages.flatMap((page) => page.posts.map((item) => item.id)),
    ["new-reel", "older-reel"]
  );

  console.log("verify-reels-cache-prepend: all assertions passed.");
}

main();
