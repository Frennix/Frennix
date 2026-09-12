import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getErrorMessage, getTechnicalErrorMessage, togglePostReaction } from "@frennix/api";
import type { Post } from "@frennix/types";
import { showAlert } from "@/lib/alerts";
import { applyPostReactionOptimistic } from "@/lib/reaction-utils";
import { findPostInAllCaches, mapPostInAllCaches } from "@/lib/post-cache";

type PostReactionVars = {
  postId: string;
  emoji: string;
  currentEmoji?: string | null;
};

export function usePostReaction(userId: string) {
  const queryClient = useQueryClient();
  const reactionChainRef = useRef(new Map<string, Promise<void>>());

  const mutation = useMutation({
    mutationFn: ({ postId, emoji, currentEmoji }: PostReactionVars) =>
      togglePostReaction(postId, userId, emoji, currentEmoji),
    onMutate: async ({ postId, emoji, currentEmoji }) => {
      await queryClient.cancelQueries({ queryKey: ["feed", userId] });
      await queryClient.cancelQueries({ queryKey: ["reels", userId] });

      const live = findPostInAllCaches(queryClient, userId, postId);
      const resolvedEmoji = currentEmoji ?? live?.my_reaction ?? null;
      const previous = live;
      mapPostInAllCaches(queryClient, userId, postId, (post) =>
        applyPostReactionOptimistic(post, emoji, resolvedEmoji)
      );

      return { previous };
    },
    onError: (error, { postId }, context) => {
      if (context?.previous) {
        mapPostInAllCaches(queryClient, userId, postId, () => context.previous as Post);
      }
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.error("[reaction] post failed", {
          postId,
          userId,
          error: getTechnicalErrorMessage(error),
        });
      }
      showAlert("Reaction failed", getErrorMessage(error));
    },
    onSettled: (_data, _error, { postId }) => {
      void queryClient.invalidateQueries({ queryKey: ["post", postId] });
      void queryClient.invalidateQueries({ queryKey: ["reels", userId] });
      void queryClient.invalidateQueries({ queryKey: ["feed", userId] });
    },
  });

  const mutate = (vars: PostReactionVars) => {
    if (!userId) return;
    const previous = reactionChainRef.current.get(vars.postId) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        const live = findPostInAllCaches(queryClient, userId, vars.postId);
        await mutation.mutateAsync({
          ...vars,
          currentEmoji: live?.my_reaction ?? vars.currentEmoji ?? null,
        });
      })
      .catch(() => undefined);
    reactionChainRef.current.set(vars.postId, next);
  };

  return { ...mutation, mutate };
}
