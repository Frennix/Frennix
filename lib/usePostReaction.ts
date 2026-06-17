import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { getErrorMessage, togglePostReaction } from "@frennix/api";
import type { FeedPage, Post } from "@frennix/types";
import { showAlert } from "@/lib/alerts";
import { patchPostsInFeedPage, applyPostReactionOptimistic } from "@/lib/reaction-utils";

type PostReactionVars = {
  postId: string;
  emoji: string;
  currentEmoji?: string | null;
};

export function usePostReaction(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, emoji, currentEmoji }: PostReactionVars) =>
      togglePostReaction(postId, userId, emoji, currentEmoji),
    onMutate: async ({ postId, emoji, currentEmoji }) => {
      await queryClient.cancelQueries({ queryKey: ["feed", userId] });

      const previousFeed = queryClient.getQueryData<InfiniteData<FeedPage>>(["feed", userId]);
      const previousPosts = queryClient.getQueriesData<Post>({ queryKey: ["post"] });

      queryClient.setQueryData<InfiniteData<FeedPage>>(["feed", userId], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => patchPostsInFeedPage(page, postId, emoji, currentEmoji)),
        };
      });

      queryClient.setQueriesData<Post>({ queryKey: ["post"] }, (old) => {
        if (!old || old.id !== postId) return old;
        return applyPostReactionOptimistic(old, emoji, currentEmoji);
      });

      queryClient.setQueriesData<FeedPage>({ queryKey: ["user-posts"] }, (old) => {
        if (!old) return old;
        return patchPostsInFeedPage(old, postId, emoji, currentEmoji);
      });

      queryClient.setQueriesData<Post[]>({ queryKey: ["group-posts"] }, (old) => {
        if (!old) return old;
        return old.map((post) =>
          post.id === postId ? applyPostReactionOptimistic(post, emoji, currentEmoji) : post
        );
      });

      queryClient.setQueriesData<Post[]>({ queryKey: ["challenge-posts"] }, (old) => {
        if (!old) return old;
        return old.map((post) =>
          post.id === postId ? applyPostReactionOptimistic(post, emoji, currentEmoji) : post
        );
      });

      queryClient.setQueriesData<Post[]>({ queryKey: ["event-posts"] }, (old) => {
        if (!old) return old;
        return old.map((post) =>
          post.id === postId ? applyPostReactionOptimistic(post, emoji, currentEmoji) : post
        );
      });

      return { previousFeed, previousPosts };
    },
    onError: (error, _vars, context) => {
      if (context?.previousFeed) {
        queryClient.setQueryData(["feed", userId], context.previousFeed);
      }
      showAlert("Reaction failed", getErrorMessage(error));
    },
  });
}
