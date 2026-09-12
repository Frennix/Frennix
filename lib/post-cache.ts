import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import type { FeedPage, Post } from "@frennix/types";

function removePostFromFeedPages(pages: FeedPage[], postId: string): FeedPage[] {
  return pages.map((page) => ({
    ...page,
    posts: page.posts.filter((post) => post.id !== postId),
  }));
}

function updatePostInFeedPages(pages: FeedPage[], updated: Post): FeedPage[] {
  return pages.map((page) => ({
    ...page,
    posts: page.posts.map((post) => (post.id === updated.id ? { ...post, ...updated } : post)),
  }));
}

export function removePostFromAllCaches(queryClient: QueryClient, userId: string, postId: string) {
  queryClient.setQueryData<InfiniteData<FeedPage>>(["feed", userId], (old) => {
    if (!old) return old;
    return {
      ...old,
      pages: removePostFromFeedPages(old.pages, postId),
    };
  });

  queryClient.setQueriesData<FeedPage>({ queryKey: ["user-posts"] }, (old) => {
    if (!old) return old;
    return { ...old, posts: old.posts.filter((post) => post.id !== postId) };
  });

  queryClient.setQueriesData<Post[]>({ queryKey: ["group-posts"] }, (old) => {
    if (!old) return old;
    return old.filter((post) => post.id !== postId);
  });

  queryClient.setQueriesData<Post[]>({ queryKey: ["challenge-posts"] }, (old) => {
    if (!old) return old;
    return old.filter((post) => post.id !== postId);
  });

  queryClient.setQueriesData<Post[]>({ queryKey: ["event-posts"] }, (old) => {
    if (!old) return old;
    return old.filter((post) => post.id !== postId);
  });

  queryClient.setQueryData<InfiniteData<FeedPage>>(["saved-posts", userId], (old) => {
    if (!old) return old;
    return {
      ...old,
      pages: removePostFromFeedPages(old.pages, postId),
    };
  });

  queryClient.setQueriesData<InfiniteData<FeedPage>>({ queryKey: ["reels", userId] }, (old) => {
    if (!old) return old;
    return {
      ...old,
      pages: removePostFromFeedPages(old.pages, postId),
    };
  });
}

function mapPostsInInfiniteFeed(
  data: InfiniteData<FeedPage> | undefined,
  postId: string,
  mapper: (post: Post) => Post
): InfiniteData<FeedPage> | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      posts: page.posts.map((post) => (post.id === postId ? mapper(post) : post)),
    })),
  };
}

export function findPostInAllCaches(
  queryClient: QueryClient,
  userId: string,
  postId: string
): Post | undefined {
  const detail = queryClient.getQueryData<Post>(["post", postId, userId]);
  if (detail?.id === postId) return detail;

  const feeds: Array<InfiniteData<FeedPage> | undefined> = [
    queryClient.getQueryData<InfiniteData<FeedPage>>(["feed", userId]),
    queryClient.getQueryData<InfiniteData<FeedPage>>(["saved-posts", userId]),
  ];
  for (const query of queryClient.getQueriesData<InfiniteData<FeedPage>>({ queryKey: ["reels", userId] })) {
    feeds.push(query[1]);
  }
  for (const feed of feeds) {
    for (const page of feed?.pages ?? []) {
      const match = page.posts.find((post) => post.id === postId);
      if (match) return match;
    }
  }
  return undefined;
}

export function mapPostInAllCaches(
  queryClient: QueryClient,
  userId: string,
  postId: string,
  mapper: (post: Post) => Post
): void {
  queryClient.setQueryData<Post>(["post", postId, userId], (old) =>
    old?.id === postId ? mapper(old) : old
  );

  queryClient.setQueryData<InfiniteData<FeedPage>>(["feed", userId], (old) =>
    mapPostsInInfiniteFeed(old, postId, mapper)
  );
  queryClient.setQueryData<InfiniteData<FeedPage>>(["saved-posts", userId], (old) =>
    mapPostsInInfiniteFeed(old, postId, mapper)
  );
  queryClient.setQueriesData<InfiniteData<FeedPage>>({ queryKey: ["reels", userId] }, (old) =>
    mapPostsInInfiniteFeed(old, postId, mapper)
  );
  queryClient.setQueriesData<FeedPage>({ queryKey: ["user-posts"] }, (old) => {
    if (!old) return old;
    return {
      ...old,
      posts: old.posts.map((post) => (post.id === postId ? mapper(post) : post)),
    };
  });
  for (const key of ["group-posts", "challenge-posts", "event-posts"] as const) {
    queryClient.setQueriesData<Post[]>({ queryKey: [key] }, (old) => {
      if (!old) return old;
      return old.map((post) => (post.id === postId ? mapper(post) : post));
    });
  }
}

export function adjustPostCommentCount(
  queryClient: QueryClient,
  userId: string,
  postId: string,
  delta: number
): void {
  mapPostInAllCaches(queryClient, userId, postId, (post) => ({
    ...post,
    comment_count: Math.max(0, (post.comment_count ?? 0) + delta),
  }));
}

export function updatePostInAllCaches(queryClient: QueryClient, userId: string, updated: Post) {
  queryClient.setQueryData<Post>(["post", updated.id, userId], (old) =>
    old ? { ...old, ...updated } : updated
  );

  queryClient.setQueryData<InfiniteData<FeedPage>>(["feed", userId], (old) => {
    if (!old) return old;
    if (updated.is_reel === true) {
      return { ...old, pages: removePostFromFeedPages(old.pages, updated.id) };
    }
    return { ...old, pages: updatePostInFeedPages(old.pages, updated) };
  });

  queryClient.setQueriesData<FeedPage>({ queryKey: ["user-posts"] }, (old) => {
    if (!old) return old;
    return {
      ...old,
      posts: old.posts.map((post) => (post.id === updated.id ? { ...post, ...updated } : post)),
    };
  });

  queryClient.setQueriesData<Post[]>({ queryKey: ["group-posts"] }, (old) => {
    if (!old) return old;
    return old.map((post) => (post.id === updated.id ? { ...post, ...updated } : post));
  });

  queryClient.setQueriesData<Post[]>({ queryKey: ["challenge-posts"] }, (old) => {
    if (!old) return old;
    return old.map((post) => (post.id === updated.id ? { ...post, ...updated } : post));
  });

  queryClient.setQueriesData<Post[]>({ queryKey: ["event-posts"] }, (old) => {
    if (!old) return old;
    return old.map((post) => (post.id === updated.id ? { ...post, ...updated } : post));
  });

  queryClient.setQueryData<InfiniteData<FeedPage>>(["saved-posts", userId], (old) => {
    if (!old) return old;
    return { ...old, pages: updatePostInFeedPages(old.pages, updated) };
  });

  queryClient.setQueriesData<InfiniteData<FeedPage>>({ queryKey: ["reels", userId] }, (old) => {
    if (!old) return old;
    return { ...old, pages: updatePostInFeedPages(old.pages, updated) };
  });
}

export async function invalidatePostQueries(
  queryClient: QueryClient,
  userId: string,
  postId?: string
) {
  const invalidations: Promise<void>[] = [
    queryClient.invalidateQueries({ queryKey: ["feed", userId] }),
    queryClient.invalidateQueries({ queryKey: ["reels", userId] }),
    queryClient.invalidateQueries({ queryKey: ["user-posts"] }),
    queryClient.invalidateQueries({ queryKey: ["group-posts"] }),
    queryClient.invalidateQueries({ queryKey: ["challenge-posts"] }),
    queryClient.invalidateQueries({ queryKey: ["event-posts"] }),
    queryClient.invalidateQueries({ queryKey: ["saved-posts", userId] }),
    queryClient.invalidateQueries({ queryKey: ["feed-stories", userId] }),
    queryClient.invalidateQueries({ queryKey: ["profile-stats", userId] }),
  ];

  if (postId) {
    invalidations.push(queryClient.invalidateQueries({ queryKey: ["post", postId] }));
  }

  await Promise.all(invalidations);
}
