import type { Post } from "@frennix/types";

/** Count consecutive new posts at the head of the feed since the user last saw the top. */
export function countNewFeedPosts(loadedPosts: Post[], headPosts: Post[]): number {
  if (!loadedPosts.length || !headPosts.length) return 0;

  const topId = loadedPosts[0].id;
  let count = 0;

  for (const post of headPosts) {
    if (post.id === topId) break;
    count++;
  }

  return count;
}
