import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import {
  blockUser,
  getErrorMessage,
  reportComment,
  reportPost,
  reportUser,
} from "@frennix/api";
import { ReportReasonSheet } from "@/components/ReportReasonSheet";
import { ContentModerationSheet } from "@/components/ContentModerationSheet";
import { confirmBlockUser, showAlert, showSuccess } from "@/lib/alerts";

type ReportTarget =
  | { type: "post"; postId: string; authorId: string }
  | { type: "comment"; commentId: string; authorId: string }
  | { type: "user"; userId: string };

export function useModeration(userId: string) {
  const queryClient = useQueryClient();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [target, setTarget] = useState<ReportTarget | null>(null);
  const [blockUserId, setBlockUserId] = useState<string | null>(null);

  const invalidateAfterBlock = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["feed", userId] });
    queryClient.invalidateQueries({ queryKey: ["user-posts"] });
    queryClient.invalidateQueries({ queryKey: ["group-posts"] });
    queryClient.invalidateQueries({ queryKey: ["challenge-posts"] });
    queryClient.invalidateQueries({ queryKey: ["event-posts"] });
    queryClient.invalidateQueries({ queryKey: ["saved-posts", userId] });
    queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    queryClient.invalidateQueries({ queryKey: ["conversations", userId] });
    queryClient.invalidateQueries({ queryKey: ["blocked-users", userId] });
    queryClient.invalidateQueries({ queryKey: ["is-following"] });
    queryClient.invalidateQueries({ queryKey: ["discover-profiles"] });
    queryClient.invalidateQueries({ queryKey: ["training-matches", userId] });
    queryClient.invalidateQueries({ queryKey: ["training-partner-candidates", userId] });
  }, [queryClient, userId]);

  const reportMutation = useMutation({
    mutationFn: async ({ reason }: { reason: string }) => {
      if (!target) return;
      if (target.type === "post") {
        await reportPost(userId, target.postId, target.authorId, reason);
      } else if (target.type === "comment") {
        await reportComment(userId, target.commentId, target.authorId, reason);
      } else {
        await reportUser(userId, target.userId, reason);
      }
    },
    onSuccess: () => {
      setReportVisible(false);
      setTarget(null);
      showSuccess("Report submitted. Our team will review it.");
    },
    onError: (error) => showAlert("Report failed", getErrorMessage(error)),
  });

  const blockMutation = useMutation({
    mutationFn: (blockedId: string) => blockUser(userId, blockedId),
    onSuccess: () => {
      invalidateAfterBlock();
      showSuccess("User blocked");
    },
    onError: (error) => showAlert("Block failed", getErrorMessage(error)),
  });

  const openPostModeration = useCallback((postId: string, authorId: string) => {
    if (!userId || authorId === userId) return;
    setTarget({ type: "post", postId, authorId });
    setBlockUserId(authorId);
    setSheetVisible(true);
  }, [userId]);

  const openCommentModeration = useCallback((commentId: string, authorId: string) => {
    if (!userId || authorId === userId) return;
    setTarget({ type: "comment", commentId, authorId });
    setBlockUserId(authorId);
    setSheetVisible(true);
  }, [userId]);

  const openUserModeration = useCallback((reportedUserId: string) => {
    if (!userId || reportedUserId === userId) return;
    setTarget({ type: "user", userId: reportedUserId });
    setBlockUserId(reportedUserId);
    setSheetVisible(true);
  }, [userId]);

  function closeSheet() {
    setSheetVisible(false);
    setBlockUserId(null);
  }

  function startReport() {
    setSheetVisible(false);
    setReportVisible(true);
  }

  function handleBlock() {
    if (!blockUserId) return;
    const blockedId = blockUserId;
    closeSheet();
    confirmBlockUser(() => blockMutation.mutate(blockedId));
  }

  function reportTitle() {
    if (!target) return "Report";
    if (target.type === "post") return "Report post";
    if (target.type === "comment") return "Report comment";
    return "Report user";
  }

  const moderationSheets = (
    <>
      <ContentModerationSheet
        visible={sheetVisible}
        onClose={closeSheet}
        onReport={startReport}
        onBlock={blockUserId ? handleBlock : undefined}
      />
      <ReportReasonSheet
        visible={reportVisible}
        title={reportTitle()}
        onClose={() => {
          setReportVisible(false);
          setTarget(null);
        }}
        onSelect={(reason) => reportMutation.mutate({ reason })}
      />
    </>
  );

  return {
    moderationSheets,
    openPostModeration,
    openCommentModeration,
    openUserModeration,
    blockMutation,
    invalidateAfterBlock,
  };
}
