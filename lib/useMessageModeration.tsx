import { useMutation } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { blockUser, getErrorMessage, reportUser } from "@frennix/api";
import { ContentModerationSheet } from "@/components/ContentModerationSheet";
import { ReportReasonSheet } from "@/components/ReportReasonSheet";
import { confirmBlockUser, showAlert, showSuccess } from "@/lib/alerts";
import { ownershipMessages } from "@/lib/ownership/messages";

type MessageModerationTarget = {
  messageId: string;
  senderId: string;
  preview?: string;
};

export function useMessageModeration(userId: string) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [target, setTarget] = useState<MessageModerationTarget | null>(null);

  const openMessageModeration = useCallback((next: MessageModerationTarget) => {
    if (!userId || next.senderId === userId) return;
    setTarget(next);
    setMenuVisible(true);
  }, [userId]);

  const reportMutation = useMutation({
    mutationFn: (reason: string) => {
      if (!target) throw new Error("No message selected");
      return reportUser(userId, target.senderId, reason);
    },
    onSuccess: (reportId) => {
      if (!reportId) return;
      setReportVisible(false);
      setMenuVisible(false);
      showSuccess(ownershipMessages.reportSubmitted);
    },
    onError: (error) => showAlert(ownershipMessages.reportFailed, getErrorMessage(error)),
  });

  const blockMutation = useMutation({
    mutationFn: () => {
      if (!target) throw new Error("No message selected");
      return blockUser(userId, target.senderId);
    },
    onSuccess: () => {
      setMenuVisible(false);
      showSuccess(ownershipMessages.userBlocked);
    },
    onError: (error) => showAlert(ownershipMessages.blockFailed, getErrorMessage(error)),
  });

  const sheets = (
    <>
      <ContentModerationSheet
        visible={menuVisible}
        title="Message options"
        onClose={() => setMenuVisible(false)}
        onReport={() => {
          setMenuVisible(false);
          setReportVisible(true);
        }}
        onBlock={
          target
            ? () => {
                confirmBlockUser(() => blockMutation.mutate());
              }
            : undefined
        }
      />
      <ReportReasonSheet
        visible={reportVisible}
        title="Report message"
        onClose={() => setReportVisible(false)}
        submitting={reportMutation.isPending}
        onSelect={(reason) => {
          if (reportMutation.isPending) return;
          reportMutation.mutate(reason);
        }}
      />
    </>
  );

  return { openMessageModeration, messageModerationSheets: sheets };
}
