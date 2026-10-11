import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { Platform } from "react-native";
import type { Post } from "@frennix/types";
import { blockUser, deletePost, getErrorMessage, getTechnicalErrorMessage, reportPost } from "@frennix/api";
import { EntityActionSheet } from "@/components/EntityActionSheet";
import { ReportReasonSheet } from "@/components/ReportReasonSheet";
import { type EntityActionId, isPlaceholderAction } from "@/lib/entity-actions";
import { copyPostLink, sharePostLink } from "@/lib/post-link";
import { postActionsForRole } from "@/lib/post-actions";
import { confirmBlockUser, confirmDeletePost, showAlert, showSuccess } from "@/lib/alerts";
import { invalidateAfterBlock } from "@/lib/ownership/invalidate-after-block";
import { ownershipMessages } from "@/lib/ownership/messages";
import { OVERLAY_Z_INDEX } from "@/lib/overlay-z-index";
import { invalidatePostQueries, removePostFromAllCaches } from "@/lib/post-cache";
import { getSharedPostTargetId } from "@frennix/ui";

interface UsePostActionsOptions {
  userId: string;
  onDeleted?: (postId: string) => void;
  /** Opens in-app SharePostSheet when Share is selected */
  onShareInApp?: (post: Post) => void;
}

export function usePostActions({ userId, onDeleted, onShareInApp }: UsePostActionsOptions) {
  const queryClient = useQueryClient();
  const [activePost, setActivePost] = useState<Post | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);

  const isOwner = Boolean(activePost && userId && activePost.author_id === userId);

  const menuActions = useMemo(
    () => (activePost ? postActionsForRole(isOwner) : []),
    [activePost, isOwner]
  );

  const closeMenu = useCallback(() => {
    setMenuVisible(false);
    setActivePost(null);
  }, []);

  const resetPostActions = useCallback(() => {
    setMenuVisible(false);
    setReportVisible(false);
    setActivePost(null);
  }, []);

  const openPostActions = useCallback(
    (post: Post) => {
      if (!userId) return;
      setActivePost(post);
      setMenuVisible(true);
    },
    [userId]
  );

  const deleteMutation = useMutation({
    mutationFn: (postId: string) => deletePost(postId, userId),
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: ["feed", userId] });
      await queryClient.cancelQueries({ queryKey: ["reels", userId] });
      const previousFeeds = queryClient.getQueriesData({ queryKey: ["feed", userId] });
      const previousReels = queryClient.getQueryData(["reels", userId]);
      removePostFromAllCaches(queryClient, userId, postId);
      return { previousFeeds, previousReels };
    },
    onError: (error, _postId, context) => {
      for (const [key, data] of context?.previousFeeds ?? []) {
        queryClient.setQueryData(key, data);
      }
      if (context?.previousReels) {
        queryClient.setQueryData(["reels", userId], context.previousReels);
      }
      console.error("[deletePost]", getTechnicalErrorMessage(error));
      showAlert("Could not delete", getErrorMessage(error) || ownershipMessages.errorGeneric);
    },
    onSuccess: async (_data, postId) => {
      queryClient.removeQueries({ queryKey: ["post", postId] });
      await invalidatePostQueries(queryClient, userId, postId);
      showSuccess(ownershipMessages.deleted("Post"));
      onDeleted?.(postId);
    },
  });

  const reportMutation = useMutation({
    mutationFn: (reason: string) => {
      if (!activePost) throw new Error("No post selected");
      return reportPost(userId, activePost.id, activePost.author_id, reason);
    },
    onSuccess: () => {
      setReportVisible(false);
      closeMenu();
      showSuccess(ownershipMessages.reportSubmitted);
    },
    onError: (error) => showAlert(ownershipMessages.reportFailed, getErrorMessage(error)),
  });

  const blockMutation = useMutation({
    mutationFn: (blockedId: string) => blockUser(userId, blockedId),
    onSuccess: async () => {
      closeMenu();
      await invalidateAfterBlock(queryClient, userId);
      showSuccess(ownershipMessages.userBlocked);
    },
    onError: (error) => showAlert(ownershipMessages.blockFailed, getErrorMessage(error)),
  });

  const editOwnedPost = useCallback(
    (post: Post) => {
      if (!userId || post.author_id !== userId) return;
      router.push({ pathname: "/edit-post/[id]", params: { id: post.id } });
    },
    [userId]
  );

  const deleteOwnedPost = useCallback(
    (post: Post) => {
      if (!userId || post.author_id !== userId) return;
      confirmDeletePost(() => {
        deleteMutation.mutate(post.id);
      });
    },
    [deleteMutation, userId]
  );

  const handleAction = useCallback(
    (actionId: EntityActionId) => {
      if (!activePost) return;

      const actions = postActionsForRole(isOwner);
      if (isPlaceholderAction(actions, actionId)) {
        closeMenu();
        showAlert("Coming soon", "This action will be available in a future update.");
        return;
      }

      const postId = getSharedPostTargetId(activePost);
      const target = activePost.shared_post ?? activePost;

      switch (actionId) {
        case "edit":
          setMenuVisible(false);
          setActivePost(null);
          editOwnedPost(activePost);
          return;
        case "delete":
          setMenuVisible(false);
          confirmDeletePost(() => {
            deleteMutation.mutate(activePost.id);
          });
          setActivePost(null);
          return;
        case "share":
          setMenuVisible(false);
          setActivePost(null);
          if (onShareInApp) {
            onShareInApp(activePost);
          } else {
            void sharePostLink(postId, target.content);
          }
          return;
        case "copy_link":
          setMenuVisible(false);
          setActivePost(null);
          void copyPostLink(postId);
          return;
        case "report":
          setMenuVisible(false);
          setReportVisible(true);
          return;
        case "block":
          setMenuVisible(false);
          confirmBlockUser(() => blockMutation.mutate(activePost.author_id));
          return;
        default:
          closeMenu();
      }
    },
    [activePost, blockMutation, closeMenu, deleteOwnedPost, editOwnedPost, isOwner, onShareInApp]
  );

  const postActionSheets = (
    <>
      <EntityActionSheet
        visible={menuVisible}
        title="Post options"
        actions={menuActions}
        onSelect={handleAction}
        onClose={closeMenu}
        rootPortal={Platform.OS === "web"}
        webZIndex={OVERLAY_Z_INDEX.commentOptions}
        portalDataAttribute="frennix-post-options"
      />
      <ReportReasonSheet
        visible={reportVisible}
        title="Report post"
        onClose={() => {
          setReportVisible(false);
          setActivePost(null);
        }}
        onSelect={(reason) => reportMutation.mutate(reason)}
        rootPortal={Platform.OS === "web"}
        webZIndex={OVERLAY_Z_INDEX.commentOptions}
        portalDataAttribute="frennix-post-report"
      />
    </>
  );

  return {
    openPostActions,
    editOwnedPost,
    deleteOwnedPost,
    resetPostActions,
    postActionSheets,
    isDeleting: deleteMutation.isPending,
    /** @deprecated Use openPostActions — kept for gradual migration */
    openViewerActions: (post: Post) => {
      if (post.author_id !== userId) openPostActions(post);
    },
  };
}
