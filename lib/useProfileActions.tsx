import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import type { Profile } from "@frennix/types";
import { blockUser, getErrorMessage, reportUser } from "@frennix/api";
import { EntityActionSheet } from "@/components/EntityActionSheet";
import { ReportReasonSheet } from "@/components/ReportReasonSheet";
import { type EntityActionId } from "@/lib/entity-actions";
import { profileActionsForRole } from "@/lib/profile-actions";
import { copyProfileLink, shareProfileLink } from "@/lib/profile-link";
import { confirmBlockUser, showAlert, showSuccess } from "@/lib/alerts";
import { ownershipMessages } from "@/lib/ownership/messages";

interface UseProfileActionsOptions {
  userId: string;
  profile: Profile | null | undefined;
}

export function useProfileActions({ userId, profile }: UseProfileActionsOptions) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);

  const isOwner = Boolean(profile && userId && profile.id === userId);
  const menuActions = useMemo(() => profileActionsForRole(isOwner), [isOwner]);

  const closeMenu = useCallback(() => setMenuVisible(false), []);

  const openProfileActions = useCallback(() => {
    if (!profile || !userId) return;
    setMenuVisible(true);
  }, [profile, userId]);

  const reportMutation = useMutation({
    mutationFn: (reason: string) => {
      if (!profile) throw new Error("No profile selected");
      return reportUser(userId, profile.id, reason);
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
      if (!profile) throw new Error("No profile selected");
      return blockUser(userId, profile.id);
    },
    onSuccess: () => {
      closeMenu();
      showSuccess(ownershipMessages.userBlocked);
    },
    onError: (error) => showAlert(ownershipMessages.blockFailed, getErrorMessage(error)),
  });

  const handleAction = useCallback(
    (actionId: EntityActionId) => {
      if (!profile) return;

      switch (actionId) {
        case "edit":
          closeMenu();
          router.push("/edit-profile");
          return;
        case "share":
          closeMenu();
          void shareProfileLink(profile.username, profile.display_name);
          return;
        case "copy_link":
          closeMenu();
          void copyProfileLink(profile.username);
          return;
        case "report":
          closeMenu();
          setReportVisible(true);
          return;
        case "block":
          closeMenu();
          confirmBlockUser(() => blockMutation.mutate());
          return;
        default:
          closeMenu();
      }
    },
    [profile, blockMutation, closeMenu]
  );

  const profileActionSheets = (
    <>
      <EntityActionSheet
        visible={menuVisible}
        title="Profile options"
        actions={menuActions}
        onSelect={handleAction}
        onClose={closeMenu}
      />
      <ReportReasonSheet
        visible={reportVisible}
        title="Report profile"
        onClose={() => setReportVisible(false)}
        onSelect={(reason) => reportMutation.mutate(reason)}
      />
    </>
  );

  return {
    openProfileActions,
    profileActionSheets,
    isOwner,
  };
}
