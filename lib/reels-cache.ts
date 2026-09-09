import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import type { FeedPage, Post } from "@frennix/types";

let pendingActiveReelId: string | null = null;

export function setPendingActiveReelId(postId: string | null) {
  pendingActiveReelId = postId;
}

export function consumePendingActiveReelId(): string | null {
  const postId = pendingActiveReelId;
  pendingActiveReelId = null;
  return postId;
}

function asCachedReel(post: Post): Post {
  return {
    ...post,
    is_reel: true,
    like_count: post.like_count ?? 0,
    comment_count: post.comment_count ?? 0,
    liked_by_me: post.liked_by_me ?? false,
    saved_by_me: post.saved_by_me ?? false,
    preview_comments: post.preview_comments ?? [],
    reactions: post.reactions ?? [],
    my_reaction: post.my_reaction ?? null,
  };
}

/** Insert a confirmed Reel at the front of Reels pages, deduplicated by post ID. */
export function prependReelToReelsPages(
  pages: FeedPage[] | undefined,
  post: Post
): FeedPage[] {
  if (post.post_type !== "video") {
    return pages?.length ? pages : [{ posts: [], nextCursor: null }];
  }

  const reel = asCachedReel({ ...post, is_reel: true, post_type: "video" });
  const sourcePages = pages?.length ? pages : [{ posts: [], nextCursor: null }];

  const withoutDuplicate = sourcePages.map((page) => ({
    ...page,
    posts: page.posts.filter((candidate) => candidate.id !== reel.id),
  }));

  const firstPage = withoutDuplicate[0] ?? { posts: [], nextCursor: null as string | null };
  const rest = withoutDuplicate.slice(1);
  return [
    {
      ...firstPage,
      posts: [reel, ...firstPage.posts],
    },
    ...rest,
  ];
}

/** Seed or update the dedicated Reels query. Never writes Feed cache. */
export function prependReelToReelsQuery(
  queryClient: QueryClient,
  userId: string,
  post: Post
) {
  if (!userId || !post?.id || post.post_type !== "video") return;

  queryClient.setQueryData<InfiniteData<FeedPage>>(["reels", userId], (old) => {
    const pages = prependReelToReelsPages(old?.pages, post);
    if (!old) {
      return {
        pages,
        pageParams: [undefined],
      };
    }

    return {
      ...old,
      pages,
    };
  });
}
