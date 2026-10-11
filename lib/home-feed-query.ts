import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import type { FeedPage, HomeFeedTab, Post } from "@frennix/types";

/** Home feed cache key. The tab is part of the key so each filter paginates on its own. */
export function homeFeedQueryKey(userId: string, tab: HomeFeedTab = "all") {
  return ["feed", userId, tab] as const;
}

export function listHomeFeedCaches(queryClient: QueryClient, userId: string) {
  return queryClient.getQueriesData<InfiniteData<FeedPage>>({ queryKey: ["feed", userId] });
}

export function flattenHomeFeedPosts(
  queryClient: QueryClient,
  userId: string,
  tab?: HomeFeedTab
): Post[] {
  if (tab) {
    const data = queryClient.getQueryData<InfiniteData<FeedPage>>(homeFeedQueryKey(userId, tab));
    return data?.pages.flatMap((page) => page.posts) ?? [];
  }

  const posts: Post[] = [];
  for (const [, data] of listHomeFeedCaches(queryClient, userId)) {
    for (const page of data?.pages ?? []) posts.push(...page.posts);
  }
  return posts;
}
