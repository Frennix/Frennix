import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import type { Challenge } from "@frennix/types";
import {
  blockUser,
  closeChallengeEarly,
  deleteChallenge,
  getChallengeParticipants,
  getErrorMessage,
  reportChallenge,
} from "@frennix/api";
import { EntityActionSheet } from "@/components/EntityActionSheet";
import { EntityListSheet } from "@/components/EntityListSheet";
import { ReportReasonSheet } from "@/components/ReportReasonSheet";
import { type EntityActionId, isPlaceholderAction } from "@/lib/entity-actions";
import { challengeActionsForRole } from "@/lib/challenge-actions";
import { copyChallengeLink, shareChallengeLink } from "@/lib/challenge-link";
import {
  confirmBlockUser,
  confirmCloseChallengeEarly,
  confirmDeleteChallenge,
  showAlert,
  showSuccess,
} from "@/lib/alerts";
import { removeChallengeFromLists, updateChallengeInLists } from "@/lib/entity-list-cache";
import { invalidateAfterBlock } from "@/lib/ownership/invalidate-after-block";
import { ownershipMessages } from "@/lib/ownership/messages";

interface UseChallengeActionsOptions {
  userId: string;
  challenge: Challenge | null | undefined;
  onDeleted?: () => void;
}

export function useChallengeActions({ userId, challenge, onDeleted }: UseChallengeActionsOptions) {
  const queryClient = useQueryClient();
  const challengeId = challenge?.id ?? "";
  const isOwner = Boolean(challenge && userId && challenge.created_by === userId);

  const [menuVisible, setMenuVisible] = useState(false);
  const [participantsVisible, setParticipantsVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);

  const menuActions = useMemo(
    () => challengeActionsForRole(isOwner, challenge),
    [isOwner, challenge]
  );

  const { data: participants = [], isLoading: participantsLoading } = useQuery({
    queryKey: ["challenge-participants", challengeId],
    queryFn: () => getChallengeParticipants(challengeId),
    enabled: participantsVisible && !!challengeId,
  });

  const participantItems = useMemo(
    () =>
      participants.map((entry) => ({
        id: entry.user_id,
        displayName: entry.profile?.display_name,
        username: entry.profile?.username,
        avatarUrl: entry.profile?.avatar_url,
      })),
    [participants]
  );

  const invalidateChallengeLists = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["challenge", challengeId] });
    await queryClient.invalidateQueries({ queryKey: ["discover-challenges"] });
    await queryClient.invalidateQueries({ queryKey: ["my-challenges", userId] });
  }, [challengeId, queryClient, userId]);

  const deleteMutation = useMutation({
    mutationFn: () => deleteChallenge(challengeId, userId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["discover-challenges"] });
      await queryClient.cancelQueries({ queryKey: ["my-challenges", userId] });
      const previousDiscover = queryClient.getQueryData<Challenge[]>(["discover-challenges"]);
      const previousMine = queryClient.getQueryData<Challenge[]>(["my-challenges", userId]);
      removeChallengeFromLists(queryClient, challengeId, userId);
      queryClient.removeQueries({ queryKey: ["challenge", challengeId] });
      queryClient.removeQueries({ queryKey: ["challenge-posts", challengeId] });
      queryClient.removeQueries({ queryKey: ["challenge-joined", challengeId] });
      queryClient.removeQueries({ queryKey: ["challenge-participants", challengeId] });
      return { previousDiscover, previousMine };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["discover-challenges"] });
      await queryClient.invalidateQueries({ queryKey: ["my-challenges", userId] });
      showSuccess(ownershipMessages.deleted("Challenge"));
      onDeleted?.();
    },
    onError: (error, _vars, context) => {
      if (context?.previousDiscover) {
        queryClient.setQueryData(["discover-challenges"], context.previousDiscover);
      }
      if (context?.previousMine) {
        queryClient.setQueryData(["my-challenges", userId], context.previousMine);
      }
      showAlert("Something went wrong", getErrorMessage(error) || ownershipMessages.errorGeneric);
    },
  });

  const closeEarlyMutation = useMutation({
    mutationFn: () => closeChallengeEarly(challengeId, userId),
    onSuccess: async () => {
      await invalidateChallengeLists();
      showSuccess(ownershipMessages.closed("Challenge"));
    },
    onError: (error) => {
      showAlert("Something went wrong", getErrorMessage(error) || ownershipMessages.errorGeneric);
    },
  });

  const reportMutation = useMutation({
    mutationFn: (reason: string) => {
      if (!challenge) throw new Error("No challenge selected");
      return reportChallenge(userId, challenge.id, challenge.created_by, reason);
    },
    onSuccess: () => {
      setReportVisible(false);
      closeMenu();
      showSuccess(ownershipMessages.reportSubmitted);
    },
    onError: (error) => showAlert(ownershipMessages.reportFailed, getErrorMessage(error)),
  });

  const blockMutation = useMutation({
    mutationFn: () => {
      if (!challenge) throw new Error("No challenge selected");
      return blockUser(userId, challenge.created_by);
    },
    onSuccess: async () => {
      closeMenu();
      await invalidateAfterBlock(queryClient, userId);
      showSuccess(ownershipMessages.userBlocked);
    },
    onError: (error) => showAlert(ownershipMessages.blockFailed, getErrorMessage(error)),
  });

  const openChallengeActions = useCallback(() => {
    if (!challenge || !userId) return;
    setMenuVisible(true);
  }, [challenge, userId]);

  const closeMenu = useCallback(() => setMenuVisible(false), []);

  const handleAction = useCallback(
    (actionId: EntityActionId) => {
      if (!challenge) return;

      const actions = challengeActionsForRole(isOwner, challenge);
      if (isPlaceholderAction(actions, actionId)) {
        closeMenu();
        showAlert("Coming soon", `${actions.find((a) => a.id === actionId)?.label} will be available in a future update.`);
        return;
      }

      switch (actionId) {
        case "edit":
          closeMenu();
          router.push(`/edit-challenge/${challenge.id}`);
          return;
        case "invite":
          closeMenu();
          router.push(`/challenge/${challenge.id}/invite`);
          return;
        case "delete":
          closeMenu();
          confirmDeleteChallenge(() => deleteMutation.mutate());
          return;
        case "share":
          closeMenu();
          void shareChallengeLink(challenge.id, challenge.title);
          return;
        case "copy_link":
          closeMenu();
          void copyChallengeLink(challenge.id);
          return;
        case "view_participants":
          closeMenu();
          setParticipantsVisible(true);
          return;
        case "view_analytics":
          closeMenu();
          showAlert("Coming soon", "View Analytics will be available in a future update.");
          return;
        case "close_early":
          closeMenu();
          confirmCloseChallengeEarly(() => closeEarlyMutation.mutate());
          return;
        case "report":
          closeMenu();
          setReportVisible(true);
          return;
        case "block":
          closeMenu();
          confirmBlockUser(() => blockMutation.mutate());
          return;
        case "duplicate":
          closeMenu();
          showAlert("Coming soon", "Duplicate Challenge will be available in a future update.");
          return;
        default:
          closeMenu();
      }
    },
    [challenge, closeMenu, closeEarlyMutation, deleteMutation, blockMutation, isOwner]
  );

  const challengeActionSheets = (
    <>
      <EntityActionSheet
        visible={menuVisible}
        title="Challenge options"
        actions={menuActions}
        onSelect={handleAction}
        onClose={closeMenu}
      />
      <EntityListSheet
        visible={participantsVisible}
        title="Participants"
        items={participantItems}
        loading={participantsLoading}
        emptyMessage="No participants yet."
        onClose={() => setParticipantsVisible(false)}
      />
      <ReportReasonSheet
        visible={reportVisible}
        title="Report challenge"
        onClose={() => setReportVisible(false)}
        onSelect={(reason) => reportMutation.mutate(reason)}
      />
    </>
  );

  return {
    openChallengeActions,
    challengeActionSheets,
    isOwner,
    isDeleting: deleteMutation.isPending,
    isClosing: closeEarlyMutation.isPending,
  };
}
