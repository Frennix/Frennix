import type { FeedCategory, Post } from "@frennix/types";

const removedFeedPostIds = new Set<string>();
let feedPeekGeneration = 0;

export function noteFeedPostRemoved(postId: string) {
  if (!postId || removedFeedPostIds.has(postId)) return;
  removedFeedPostIds.add(postId);
  feedPeekGeneration += 1;
}

export function currentFeedPeekGeneration() {
  return feedPeekGeneration;
}

export function removedFeedPostIdsSnapshot(): ReadonlySet<string> {
  return removedFeedPostIds;
}

type CountNewFeedPostsOptions = {
  viewerId?: string;
  removedIds?: ReadonlySet<string>;
  feedCategory?: FeedCategory | null;
};

function eligibleForFeed(post: Post, feedCategory?: FeedCategory | null) {
  if (!feedCategory) return true;
  return post.feed_category === feedCategory;
}

/**
 * Count unique head posts that are still on the server, eligible for this tab,
 * and not already in the loaded feed. Own posts already on screen are excluded
 * because their ids are in the loaded list.
 */
export function countNewFeedPosts(
  loadedPosts: Post[],
  headPosts: Post[],
  options: CountNewFeedPostsOptions = {}
): number {
  if (!headPosts.length) return 0;

  const seen = new Set(loadedPosts.map((post) => post.id));
  const removed = options.removedIds ?? removedFeedPostIds;
  const counted = new Set<string>();

  for (const post of headPosts) {
    if (!post?.id || counted.has(post.id) || seen.has(post.id) || removed.has(post.id)) continue;
    if (!eligibleForFeed(post, options.feedCategory)) continue;
    if (options.viewerId && post.author_id === options.viewerId && seen.has(post.id)) continue;
    counted.add(post.id);
  }

  return counted.size;
}
