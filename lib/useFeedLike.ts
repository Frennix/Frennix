import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { getErrorMessage, toggleLike } from "@frennix/api";
import type { FeedPage, Post } from "@frennix/types";
import { showAlert } from "@/lib/alerts";
import { hapticLike } from "@/lib/haptics";

function findPostInFeed(feed: InfiniteData<FeedPage> | undefined, postId: string): Post | undefined {
  if (!feed) return undefined;
  for (const page of feed.pages) {
    const post = page.posts.find((p) => p.id === postId);
    if (post) return post;
  }
  return undefined;
}

function patchPostLike(post: Post, liked: boolean): Post {
  return {
    ...post,
    liked_by_me: !liked,
    like_count: Math.max(0, (post.like_count ?? 0) + (liked ? -1 : 1)),
  };
}

function patchPostsInFeedPage(page: FeedPage, postId: string, liked: boolean): FeedPage {
  return {
    ...page,
    posts: page.posts.map((p) => (p.id === postId ? patchPostLike(p, liked) : p)),
  };
}

function patchFeed(
  feed: InfiniteData<FeedPage>,
  postId: string,
  liked: boolean
): InfiniteData<FeedPage> {
  return {
    ...feed,
    pages: feed.pages.map((page) => patchPostsInFeedPage(page, postId, liked)),
  };
}

type LikeVars = { postId: string; liked: boolean };

export function useFeedLike(userId: string) {
  const queryClient = useQueryClient();

  const likeMutation = useMutation({
    mutationFn: ({ postId, liked }: LikeVars) => toggleLike(postId, userId, liked),
    onMutate: ({ postId, liked }) => {
      if (!liked) hapticLike();

      const previousFeed = queryClient.getQueryData<InfiniteData<FeedPage>>(["feed", userId]);
      const previousPost = queryClient.getQueryData<Post>(["post", postId, userId]);

      if (previousFeed) {
        queryClient.setQueryData<InfiniteData<FeedPage>>(
          ["feed", userId],
          patchFeed(previousFeed, postId, liked)
        );
      }

      if (previousPost) {
        queryClient.setQueryData<Post>(["post", postId, userId], patchPostLike(previousPost, liked));
      }

      void queryClient.cancelQueries({ queryKey: ["feed", userId] });

      return { previousFeed, previousPost };
    },
    onError: (error, { postId }, context) => {
      if (context?.previousFeed) {
        queryClient.setQueryData(["feed", userId], context.previousFeed);
      }
      if (context?.previousPost) {
        queryClient.setQueryData(["post", postId, userId], context.previousPost);
      }
      showAlert("Like failed", getErrorMessage(error));
    },
  });

  function toggleLikePost(postId: string) {
    if (!userId) return;

    const feed = queryClient.getQueryData<InfiniteData<FeedPage>>(["feed", userId]);
    const liked = !!findPostInFeed(feed, postId)?.liked_by_me;
    likeMutation.mutate({ postId, liked });
  }

  return { toggleLikePost };
}
