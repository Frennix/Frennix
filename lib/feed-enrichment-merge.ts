import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import type { FeedPage, Post } from "@frennix/types";

/**
 * Overlay a background enrichment snapshot onto a cached post without
 * wiping an optimistic like/unlike that landed while enrichment was in flight.
 */
export function reconcileEnrichedPost(current: Post, enriched: Post): Post {
  const enrichedCount = enriched.like_count ?? 0;
  const currentCount = current.like_count ?? 0;

  if (current.liked_by_me && !enriched.liked_by_me) {
    return {
      ...enriched,
      liked_by_me: true,
      like_count: enrichedCount + 1,
    };
  }

  if (!current.liked_by_me && enriched.liked_by_me && currentCount === enrichedCount - 1) {
    return {
      ...enriched,
      liked_by_me: false,
      like_count: Math.max(0, enrichedCount - 1),
    };
  }

  return enriched;
}

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
        posts: page.posts.map((post) => {
          const enriched = enrichedById.get(post.id);
          return enriched ? reconcileEnrichedPost(post, enriched) : post;
        }),
      };
    });

    return { ...current, pages };
  });
}
