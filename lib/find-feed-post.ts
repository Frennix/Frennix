import type { QueryClient } from "@tanstack/react-query";
import type { Post } from "@frennix/types";
import { getSharedPostTargetId } from "@frennix/ui";
import { flattenHomeFeedPosts } from "@/lib/home-feed-query";

/** Find a feed post by id from the React Query feed cache. */
export function findFeedPostById(
  queryClient: QueryClient,
  userId: string,
  postId: string
): Post | undefined {
  const posts = flattenHomeFeedPosts(queryClient, userId);
  return posts.find((post) => getSharedPostTargetId(post) === postId);
}
