import assert from "node:assert/strict";
import { QueryClient } from "@tanstack/react-query";
import { isUniqueConstraintError } from "../packages/api/src/profile-utils.ts";
import {
  overlayCachedFeedInteractions,
  preserveCachedPostInteractions,
  reconcileEnrichedPost,
} from "../lib/feed-enrichment-merge.ts";
import { findPostInAllCaches, mapPostInAllCaches } from "../lib/post-cache.ts";
import type { Post } from "../packages/types/src/index.ts";

function post(partial: Partial<Post> & Pick<Post, "id">): Post {
  return {
    author_id: "author",
    content: "",
    media_urls: [],
    post_type: "workout",
    created_at: "2026-01-01T00:00:00.000Z",
    ...partial,
  } as Post;
}

function main() {
  const stale = post({ id: "p1", liked_by_me: false, like_count: 5 });
  const optimisticLike = post({ id: "p1", liked_by_me: true, like_count: 6 });
  const mergedLike = reconcileEnrichedPost(optimisticLike, stale);
  assert.equal(mergedLike.liked_by_me, true);
  assert.equal(mergedLike.like_count, 6);

  const serverLiked = post({ id: "p1", liked_by_me: true, like_count: 6 });
  const optimisticUnlike = post({ id: "p1", liked_by_me: false, like_count: 5 });
  const mergedUnlike = reconcileEnrichedPost(optimisticUnlike, serverLiked);
  assert.equal(mergedUnlike.liked_by_me, false);
  assert.equal(mergedUnlike.like_count, 5);

  const placeholder = post({ id: "p1", liked_by_me: false, like_count: 0 });
  const firstEnrich = post({ id: "p1", liked_by_me: true, like_count: 6 });
  const mergedFirst = reconcileEnrichedPost(placeholder, firstEnrich);
  assert.equal(mergedFirst.liked_by_me, true);
  assert.equal(mergedFirst.like_count, 6);

  // The live bug: after Like, feed refetch placeholders (0) then enrichment
  // returns the saved like (1). That must not look like an optimistic unlike.
  const justLikedPlaceholder = post({ id: "p-photo", liked_by_me: false, like_count: 0 });
  const savedLike = post({ id: "p-photo", liked_by_me: true, like_count: 1 });
  const mergedSavedLike = reconcileEnrichedPost(justLikedPlaceholder, savedLike);
  assert.equal(mergedSavedLike.liked_by_me, true, "placeholder vs 1 like must keep the saved like");
  assert.equal(mergedSavedLike.like_count, 1);

  const afterLogoutPlaceholder = post({ id: "p-login", liked_by_me: false, like_count: 0 });
  const likedOnServer = post({ id: "p-login", liked_by_me: true, like_count: 1 });
  const restored = reconcileEnrichedPost(afterLogoutPlaceholder, likedOnServer);
  assert.equal(restored.liked_by_me, true, "post liked_by_me must survive logout/login enrichment");
  assert.equal(restored.like_count, 1);

  const optimisticAfterLike = post({
    id: "p-keep",
    liked_by_me: true,
    like_count: 1,
    comment_count: 2,
  });
  const refetchPlaceholder = post({ id: "p-keep", liked_by_me: false, like_count: 0 });
  const preserved = preserveCachedPostInteractions(refetchPlaceholder, optimisticAfterLike);
  assert.equal(preserved.liked_by_me, true);
  assert.equal(preserved.like_count, 1);
  assert.equal(preserved.comment_count, 2);

  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } });
  queryClient.setQueryData(["feed", "user-1"], {
    pages: [{ posts: [optimisticAfterLike], nextCursor: null }],
    pageParams: [undefined],
  });
  const overlaid = overlayCachedFeedInteractions(queryClient, "user-1", {
    posts: [refetchPlaceholder],
    nextCursor: null,
  });
  assert.equal(overlaid.posts[0]?.liked_by_me, true);
  assert.equal(overlaid.posts[0]?.like_count, 1);

  mapPostInAllCaches(queryClient, "user-1", "p-keep", (current) => ({
    ...current,
    liked_by_me: false,
    like_count: 0,
  }));
  queryClient.setQueryData(["user-posts", "author", "user-1"], {
    posts: [post({ id: "p-profile", liked_by_me: false, like_count: 4 })],
    nextCursor: null,
  });
  mapPostInAllCaches(queryClient, "user-1", "p-profile", (current) => ({
    ...current,
    liked_by_me: true,
    like_count: 5,
  }));
  const profilePost = findPostInAllCaches(queryClient, "user-1", "p-profile");
  assert.equal(profilePost?.liked_by_me, true);
  assert.equal(profilePost?.like_count, 5);

  assert.equal(isUniqueConstraintError({ code: "23505", message: "duplicate key" }), true);
  assert.equal(isUniqueConstraintError({ code: "42501", message: "row-level security" }), false);

  console.log("verify-like-toggle: ok");
}

main();
