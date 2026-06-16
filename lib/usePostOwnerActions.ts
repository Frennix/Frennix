import { router } from "expo-router";
import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { deletePost, getErrorMessage } from "@frennix/api";
import type { FeedPage, Post } from "@frennix/types";
import { confirmDeletePost, showAlert, showSuccess } from "@/lib/alerts";

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

  const removeFromFeedCache = useCallback(
    (postId: string) => {
      queryClient.setQueryData<InfiniteData<FeedPage>>(["feed", userId], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            posts: page.posts.filter((p) => p.id !== postId),
          })),
        };
      });

      queryClient.setQueriesData<FeedPage>({ queryKey: ["user-posts"] }, (old) => {
        if (!old) return old;
        return { ...old, posts: old.posts.filter((p) => p.id !== postId) };
      });

      queryClient.setQueriesData<Post[]>({ queryKey: ["group-posts"] }, (old) => {
        if (!old) return old;
        return old.filter((p) => p.id !== postId);
      });
    },
    [queryClient, userId]
  );

  const deleteMutation = useMutation({
    mutationFn: (postId: string) => deletePost(postId, userId),
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: ["feed", userId] });
      const previous = queryClient.getQueryData<InfiniteData<FeedPage>>(["feed", userId]);
      removeFromFeedCache(postId);
      return { previous };
    },
    onError: (error, _postId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["feed", userId], context.previous);
      }
      showAlert("Delete failed", getErrorMessage(error));
    },
    onSuccess: (_data, postId) => {
      queryClient.invalidateQueries({ queryKey: ["feed", userId] });
      queryClient.invalidateQueries({ queryKey: ["user-posts"] });
      queryClient.invalidateQueries({ queryKey: ["group-posts"] });
      queryClient.removeQueries({ queryKey: ["post", postId] });
      showSuccess("Post deleted");
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
