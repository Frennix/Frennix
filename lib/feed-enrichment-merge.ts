import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import type { FeedPage, Post } from "@frennix/types";

/** Merge batched interaction/reaction enrichment into one feed page without replacing newer data. */
export function mergeEnrichedFeedPage(
  queryClient: QueryClient,
  userId: string,
  pageIndex: number,
  enrichedPosts: Post[]
) {
  queryClient.setQueryData<InfiniteData<FeedPage>>(["feed", userId], (current) => {
    if (!current?.pages[pageIndex]) return current;

    const enrichedById = new Map(enrichedPosts.map((post) => [post.id, post]));
    const pages = current.pages.map((page, index) => {
      if (index !== pageIndex) return page;
      return {
        ...page,
        posts: page.posts.map((post) => enrichedById.get(post.id) ?? post),
      };
    });

    return { ...current, pages };
  });
}
