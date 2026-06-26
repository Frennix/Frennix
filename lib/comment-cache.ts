import type { Comment } from "@frennix/types";
import type { QueryClient } from "@tanstack/react-query";

export function removeCommentFromTree(comments: Comment[], commentId: string): Comment[] {
  return comments
    .filter((comment) => comment.id !== commentId)
    .map((comment) => ({
      ...comment,
      replies: comment.replies?.length
        ? removeCommentFromTree(comment.replies, commentId)
        : comment.replies,
    }));
}

export function updateCommentInTree(
  comments: Comment[],
  commentId: string,
  content: string
): Comment[] {
  return comments.map((comment) => {
    if (comment.id === commentId) {
      return { ...comment, content };
    }
    if (comment.replies?.length) {
      return {
        ...comment,
        replies: updateCommentInTree(comment.replies, commentId, content),
      };
    }
    return comment;
  });
}

export function patchCommentsCache(
  queryClient: QueryClient,
  postId: string,
  userId: string,
  updater: (comments: Comment[]) => Comment[]
) {
  const key = ["comments", postId, userId] as const;
  const current = queryClient.getQueryData<Comment[]>(key);
  if (!current) return;
  queryClient.setQueryData(key, updater(current));
}
