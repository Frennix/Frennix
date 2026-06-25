import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { deletePost, getErrorMessage } from "@frennix/api";
import type { Post } from "@frennix/types";
import { confirmDeletePost, showAlert, showSuccess } from "@/lib/alerts";
import { invalidatePostQueries, removePostFromAllCaches } from "@/lib/post-cache";

interface UsePostOwnerActionsOptions {
  userId: string;
  onDeleted?: (postId: string) => void;
}

export function usePostOwnerActions({ userId, onDeleted }: UsePostOwnerActionsOptions) {
  const queryClient = useQueryClient();
  const [activePost, setActivePost] = useState<Post | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  const openActions = useCallback((post: Post) => {
    setActivePost(post);
    setSheetVisible(true);
  }, []);

  const closeActions = useCallback(() => {
    setSheetVisible(false);
    setActivePost(null);
  }, []);

  const deleteMutation = useMutation({
    mutationFn: (postId: string) => deletePost(postId, userId),
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: ["feed", userId] });
      const previous = queryClient.getQueryData(["feed", userId]);
      removePostFromAllCaches(queryClient, userId, postId);
      return { previous };
    },
    onError: (error, _postId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["feed", userId], context.previous);
      }
      showAlert("Something went wrong", getErrorMessage(error) || "Please try again.");
    },
    onSuccess: async (_data, postId) => {
      queryClient.removeQueries({ queryKey: ["post", postId] });
      await invalidatePostQueries(queryClient, userId, postId);
      showSuccess("Workout deleted.");
      onDeleted?.(postId);
    },
  });

  const handleEdit = useCallback(() => {
    if (!activePost) return;
    const postId = activePost.id;
    setSheetVisible(false);
    setActivePost(null);
    router.push({ pathname: "/edit-post/[id]", params: { id: postId } });
  }, [activePost]);

  const handleDelete = useCallback(() => {
    if (!activePost) return;
    const postId = activePost.id;
    setSheetVisible(false);
    confirmDeletePost(() => {
      setActivePost(null);
      deleteMutation.mutate(postId);
    });
  }, [activePost, deleteMutation]);

  return {
    openPostActions: openActions,
    actionSheetProps: {
      visible: sheetVisible,
      onClose: closeActions,
      onEdit: handleEdit,
      onDelete: handleDelete,
    },
    isDeleting: deleteMutation.isPending,
  };
}
