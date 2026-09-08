import assert from "node:assert/strict";
import { isUniqueConstraintError } from "../packages/api/src/profile-utils.ts";
import { reconcileEnrichedPost } from "../lib/feed-enrichment-merge.ts";
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

  assert.equal(isUniqueConstraintError({ code: "23505", message: "duplicate key" }), true);
  assert.equal(isUniqueConstraintError({ code: "42501", message: "row-level security" }), false);

  console.log("verify-like-toggle: ok");
}

main();
