import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getErrorMessage, getTechnicalErrorMessage, toggleLike } from "@frennix/api";
import type { Post } from "@frennix/types";
import { showAlert } from "@/lib/alerts";
import { hapticLike } from "@/lib/haptics";
import { findPostInAllCaches, mapPostInAllCaches } from "@/lib/post-cache";

function patchPostLike(post: Post, liked: boolean): Post {
  return {
    ...post,
    liked_by_me: !liked,
    like_count: Math.max(0, (post.like_count ?? 0) + (liked ? -1 : 1)),
  };
}

type LikeVars = { postId: string; liked: boolean };

const DUPLICATE_PRESS_MS = 400;

export function useFeedLike(userId: string) {
  const queryClient = useQueryClient();
  const likeChainRef = useRef(new Map<string, Promise<void>>());
  const lastToggleAtRef = useRef(new Map<string, number>());

  const likeMutation = useMutation({
    mutationFn: ({ postId, liked }: LikeVars) => toggleLike(postId, userId, liked),
    onMutate: ({ postId, liked }) => {
      if (!liked) hapticLike();

      const previous = findPostInAllCaches(queryClient, userId, postId);
      mapPostInAllCaches(queryClient, userId, postId, (post) => patchPostLike(post, liked));

      void queryClient.cancelQueries({ queryKey: ["feed", userId] });
      void queryClient.cancelQueries({ queryKey: ["reels", userId] });

      return { previous };
    },
    onError: (error, { postId }, context) => {
      if (context?.previous) {
        mapPostInAllCaches(queryClient, userId, postId, () => context.previous as Post);
      }
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.error("[like] post failed", {
          postId,
          userId,
          error: getTechnicalErrorMessage(error),
        });
      }
      showAlert("Like failed", getErrorMessage(error, "Couldn't update that like. Please try again."));
    },
    onSettled: (_data, _error, { postId }) => {
      void queryClient.invalidateQueries({ queryKey: ["post", postId] });
      void queryClient.invalidateQueries({ queryKey: ["reels", userId] });
      void queryClient.invalidateQueries({ queryKey: ["feed", userId] });
    },
  });

  function readLiked(postId: string): boolean {
    return Boolean(findPostInAllCaches(queryClient, userId, postId)?.liked_by_me);
  }

  function toggleLikePost(postId: string) {
    if (!userId) return;

    const now = Date.now();
    const lastToggleAt = lastToggleAtRef.current.get(postId) ?? 0;
    if (now - lastToggleAt < DUPLICATE_PRESS_MS) return;
    lastToggleAtRef.current.set(postId, now);

    const previous = likeChainRef.current.get(postId) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        await likeMutation.mutateAsync({ postId, liked: readLiked(postId) });
      })
      .catch(() => undefined);
    likeChainRef.current.set(postId, next);
  }

  return { toggleLikePost };
}
