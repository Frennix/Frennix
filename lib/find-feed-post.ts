import type { QueryClient } from "@tanstack/react-query";
import type { Post } from "@frennix/types";
import { getSharedPostTargetId } from "@frennix/ui";

/** Find a feed post by id from the React Query feed cache. */
export function findFeedPostById(
  queryClient: QueryClient,
  userId: string,
  postId: string
): Post | undefined {
  const posts =
    queryClient
      .getQueryData<{ pages: { posts: Post[] }[] }>(["feed", userId])
      ?.pages.flatMap((page) => page.posts) ?? [];
  return posts.find((post) => getSharedPostTargetId(post) === postId);
}
