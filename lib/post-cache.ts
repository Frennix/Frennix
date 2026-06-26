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
}

export function updatePostInAllCaches(queryClient: QueryClient, userId: string, updated: Post) {
  queryClient.setQueryData<Post>(["post", updated.id, userId], (old) =>
    old ? { ...old, ...updated } : updated
  );

  queryClient.setQueryData<InfiniteData<FeedPage>>(["feed", userId], (old) => {
    if (!old) return old;
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
}

export async function invalidatePostQueries(
  queryClient: QueryClient,
  userId: string,
  postId?: string
) {
  const invalidations: Promise<void>[] = [
    queryClient.invalidateQueries({ queryKey: ["feed", userId] }),
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
