import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import type { Comment } from "@frennix/types";
import {
  blockUser,
  deleteComment,
  getErrorMessage,
  reportComment,
  updateComment,
} from "@frennix/api";
import { CommentEditSheet } from "@/components/CommentEditSheet";
import { EntityActionSheet } from "@/components/EntityActionSheet";
import { ReportReasonSheet } from "@/components/ReportReasonSheet";
import { type EntityActionId } from "@/lib/entity-actions";
import { commentActionsForRole } from "@/lib/comment-actions";
import {
  patchCommentsCache,
  removeCommentFromTree,
  updateCommentInTree,
} from "@/lib/comment-cache";
import { copyCommentLink, shareCommentLink } from "@/lib/comment-link";
import { confirmBlockUser, confirmDeleteComment, showAlert, showSuccess } from "@/lib/alerts";
import { invalidateAfterBlock } from "@/lib/ownership/invalidate-after-block";
import { ownershipMessages } from "@/lib/ownership/messages";

interface UseCommentActionsOptions {
  userId: string;
  postId: string;
  onDeleted?: () => void;
}

export function useCommentActions({ userId, postId, onDeleted }: UseCommentActionsOptions) {
  const queryClient = useQueryClient();
  const [activeComment, setActiveComment] = useState<Comment | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);

  const isOwner = Boolean(activeComment && userId && activeComment.author_id === userId);

  const menuActions = useMemo(
    () => (activeComment ? commentActionsForRole(isOwner) : []),
    [activeComment, isOwner]
  );

  const closeMenu = useCallback(() => {
    setMenuVisible(false);
    setActiveComment(null);
  }, []);

  const openCommentActions = useCallback(
    (comment: Comment) => {
      if (!userId) return;
      setActiveComment(comment);
      setMenuVisible(true);
    },
    [userId]
  );

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) => deleteComment(commentId, userId),
    onMutate: async (commentId) => {
      patchCommentsCache(queryClient, postId, userId, (comments) =>
        removeCommentFromTree(comments, commentId)
      );
    },
    onSuccess: () => {
      closeMenu();
      showSuccess(ownershipMessages.deleted("Comment"));
      queryClient.invalidateQueries({ queryKey: ["post", postId] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      onDeleted?.();
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: ["comments", postId] });
      showAlert("Something went wrong", getErrorMessage(error) || ownershipMessages.errorGeneric);
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) =>
      updateComment(commentId, userId, content),
    onSuccess: (_data, variables) => {
      patchCommentsCache(queryClient, postId, userId, (comments) =>
        updateCommentInTree(comments, variables.commentId, variables.content.trim())
      );
      setEditVisible(false);
      closeMenu();
      showSuccess(ownershipMessages.updated("Comment"));
    },
    onError: (error) => showAlert("Something went wrong", getErrorMessage(error)),
  });

  const reportMutation = useMutation({
    mutationFn: (reason: string) => {
      if (!activeComment) throw new Error("No comment selected");
      return reportComment(userId, activeComment.id, activeComment.author_id, reason);
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

  const handleAction = useCallback(
    (actionId: EntityActionId) => {
      if (!activeComment) return;

      switch (actionId) {
        case "edit":
          setMenuVisible(false);
          setEditVisible(true);
          return;
        case "delete":
          setMenuVisible(false);
          confirmDeleteComment(() => {
            deleteMutation.mutate(activeComment.id);
            setActiveComment(null);
          });
          return;
        case "share":
          setMenuVisible(false);
          setActiveComment(null);
          void shareCommentLink(postId, activeComment.id, activeComment.content);
          return;
        case "copy_link":
          setMenuVisible(false);
          setActiveComment(null);
          void copyCommentLink(postId, activeComment.id);
          return;
        case "report":
          setMenuVisible(false);
          setReportVisible(true);
          return;
        case "block":
          setMenuVisible(false);
          confirmBlockUser(() => blockMutation.mutate(activeComment.author_id));
          return;
        default:
          closeMenu();
      }
    },
    [activeComment, blockMutation, closeMenu, deleteMutation, postId]
  );

  const commentActionSheets = (
    <>
      <EntityActionSheet
        visible={menuVisible}
        title="Comment options"
        actions={menuActions}
        onSelect={handleAction}
        onClose={closeMenu}
      />
      <CommentEditSheet
        visible={editVisible}
        initialContent={activeComment?.content ?? ""}
        loading={editMutation.isPending}
        onClose={() => {
          setEditVisible(false);
          setActiveComment(null);
        }}
        onSave={(content) => {
          if (!activeComment) return;
          editMutation.mutate({ commentId: activeComment.id, content });
        }}
      />
      <ReportReasonSheet
        visible={reportVisible}
        title="Report comment"
        onClose={() => {
          setReportVisible(false);
          setActiveComment(null);
        }}
        onSelect={(reason) => reportMutation.mutate(reason)}
      />
    </>
  );

  return {
    openCommentActions,
    commentActionSheets,
  };
}
