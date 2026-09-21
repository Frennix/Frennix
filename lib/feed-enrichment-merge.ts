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

  // Only treat this as an optimistic unlike when the cache already had a
  // real count. Placeholders use like_count 0, which matches every
  // single-like post (enrichedCount - 1 === 0) and would wipe login hydration.
  if (
    !current.liked_by_me &&
    enriched.liked_by_me &&
    currentCount > 0 &&
    currentCount === enrichedCount - 1
  ) {
    return {
      ...enriched,
      liked_by_me: false,
      like_count: Math.max(0, enrichedCount - 1),
    };
  }

  return enriched;
}

/** True when a feed row still has default interaction fields, not enriched stats. */
export function isPlaceholderPostInteractions(post: Post): boolean {
  return (
    !post.liked_by_me &&
    (post.like_count ?? 0) === 0 &&
    (post.comment_count ?? 0) === 0 &&
    !(post.preview_comments?.length) &&
    !(post.reactions?.length)
  );
}

/**
 * Keep cached likes/comments when the feed query returns unenriched placeholders.
 * Otherwise a refetch after Like flashes the unliked heart and can stick.
 */
export function preserveCachedPostInteractions(incoming: Post, cached?: Post): Post {
  if (!cached || cached.id !== incoming.id) return incoming;
  if (!isPlaceholderPostInteractions(incoming)) return incoming;
  if (isPlaceholderPostInteractions(cached)) return incoming;

  return {
    ...incoming,
    liked_by_me: cached.liked_by_me,
    like_count: cached.like_count,
    comment_count: cached.comment_count ?? incoming.comment_count,
    saved_by_me: cached.saved_by_me ?? incoming.saved_by_me,
    preview_comments: cached.preview_comments ?? incoming.preview_comments,
    reactions: cached.reactions ?? incoming.reactions,
    my_reaction: cached.my_reaction ?? incoming.my_reaction,
  };
}

export function overlayCachedFeedInteractions(
  queryClient: QueryClient,
  userId: string,
  page: FeedPage
): FeedPage {
  const current = queryClient.getQueryData<InfiniteData<FeedPage>>(["feed", userId]);
  if (!current) return page;

  const byId = new Map<string, Post>();
  for (const existingPage of current.pages) {
    for (const post of existingPage.posts) {
      byId.set(post.id, post);
    }
  }

  return {
    ...page,
    posts: page.posts.map((post) => preserveCachedPostInteractions(post, byId.get(post.id))),
  };
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
