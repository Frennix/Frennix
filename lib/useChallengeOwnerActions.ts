import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { deleteChallenge, getErrorMessage } from "@frennix/api";
import { confirmDeleteChallenge, showAlert, showSuccess } from "@/lib/alerts";

interface UseChallengeOwnerActionsOptions {
  userId: string;
  challengeId: string;
  onDeleted?: () => void;
}

export function useChallengeOwnerActions({
  userId,
  challengeId,
  onDeleted,
}: UseChallengeOwnerActionsOptions) {
  const queryClient = useQueryClient();
  const [sheetVisible, setSheetVisible] = useState(false);

  const openActions = useCallback(() => {
    setSheetVisible(true);
  }, []);

  const closeActions = useCallback(() => {
    setSheetVisible(false);
  }, []);

  const deleteMutation = useMutation({
    mutationFn: () => deleteChallenge(challengeId, userId),
    onSuccess: async () => {
      setSheetVisible(false);
      queryClient.removeQueries({ queryKey: ["challenge", challengeId] });
      queryClient.removeQueries({ queryKey: ["challenge-posts", challengeId] });
      queryClient.removeQueries({ queryKey: ["challenge-joined", challengeId] });
      await queryClient.invalidateQueries({ queryKey: ["discover-challenges"] });
      await queryClient.invalidateQueries({ queryKey: ["my-challenges", userId] });
      showSuccess("Challenge deleted.");
      onDeleted?.();
    },
    onError: (error) => {
      showAlert("Something went wrong", getErrorMessage(error) || "Please try again.");
    },
  });

  const handleEdit = useCallback(() => {
    setSheetVisible(false);
    router.push({ pathname: "/edit-challenge/[id]", params: { id: challengeId } });
  }, [challengeId]);

  const handleDelete = useCallback(() => {
    setSheetVisible(false);
    confirmDeleteChallenge(() => deleteMutation.mutate());
  }, [deleteMutation]);

  return {
    openChallengeActions: openActions,
    actionSheetProps: {
      visible: sheetVisible,
      onClose: closeActions,
      onEdit: handleEdit,
      onDelete: handleDelete,
    },
    isDeleting: deleteMutation.isPending,
  };
}
