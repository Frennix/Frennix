import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getErrorMessage, getTechnicalErrorMessage, toggleCommentLike } from "@frennix/api";
import type { Comment } from "@frennix/types";
import { showAlert } from "@/lib/alerts";

function patchCommentLike(comments: Comment[], commentId: string, liked: boolean): Comment[] {
  return comments.map((comment) => {
    if (comment.id === commentId) {
      return {
        ...comment,
        liked_by_me: !liked,
        like_count: Math.max(0, (comment.like_count ?? 0) + (liked ? -1 : 1)),
      };
    }
    if (comment.replies?.length) {
      return { ...comment, replies: patchCommentLike(comment.replies, commentId, liked) };
    }
    return comment;
  });
}

function findCommentLiked(comments: Comment[] | undefined, commentId: string): boolean | undefined {
  if (!comments) return undefined;
  for (const comment of comments) {
    if (comment.id === commentId) return !!comment.liked_by_me;
    const nested = findCommentLiked(comment.replies, commentId);
    if (nested !== undefined) return nested;
  }
  return undefined;
}

type LikeVars = { commentId: string; liked: boolean };

const DUPLICATE_PRESS_MS = 400;

export function useCommentLike(postId: string, userId: string) {
  const queryClient = useQueryClient();
  const likeChainRef = useRef(new Map<string, Promise<void>>());
  const lastToggleAtRef = useRef(new Map<string, number>());

  const commentLikeMutation = useMutation({
    mutationFn: ({ commentId, liked }: LikeVars) => toggleCommentLike(commentId, userId, liked),
    onMutate: ({ commentId, liked }) => {
      const queryKey = ["comments", postId, userId] as const;
      const previousComments = queryClient.getQueryData<Comment[]>(queryKey);

      if (previousComments) {
        queryClient.setQueryData<Comment[]>(queryKey, patchCommentLike(previousComments, commentId, liked));
      }

      void queryClient.cancelQueries({ queryKey: ["comments", postId] });

      return { previousComments };
    },
    onError: (error, { commentId }, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(["comments", postId, userId], context.previousComments);
      }
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.error("[like] comment failed", {
          postId,
          commentId,
          userId,
          error: getTechnicalErrorMessage(error),
        });
      }
      showAlert("Like failed", getErrorMessage(error, "Couldn't update that like. Please try again."));
    },
  });

  function toggleCommentLikeState(commentId: string, liked?: boolean) {
    if (!userId || !postId) return;

    const now = Date.now();
    const lastToggleAt = lastToggleAtRef.current.get(commentId) ?? 0;
    if (now - lastToggleAt < DUPLICATE_PRESS_MS) return;
    lastToggleAtRef.current.set(commentId, now);

    const previous = likeChainRef.current.get(commentId) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        const comments = queryClient.getQueryData<Comment[]>(["comments", postId, userId]);
        const currentLiked = findCommentLiked(comments, commentId) ?? !!liked;
        await commentLikeMutation.mutateAsync({ commentId, liked: currentLiked });
      })
      .catch(() => undefined);
    likeChainRef.current.set(commentId, next);
  }

  return { toggleCommentLikeState };
}
