import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import type { Group } from "@frennix/types";
import {
  blockUser,
  deleteGroup,
  getErrorMessage,
  getGroupMembers,
  reportGroup,
} from "@frennix/api";
import { EntityActionSheet } from "@/components/EntityActionSheet";
import { EntityListSheet } from "@/components/EntityListSheet";
import { ReportReasonSheet } from "@/components/ReportReasonSheet";
import { type EntityActionId, isPlaceholderAction } from "@/lib/entity-actions";
import { groupActionsForRole } from "@/lib/group-actions";
import { copyGroupLink, shareGroupLink } from "@/lib/group-link";
import { confirmBlockUser, confirmDeleteGroup, showAlert, showSuccess } from "@/lib/alerts";
import { removeGroupFromLists } from "@/lib/entity-list-cache";
import { invalidateAfterBlock } from "@/lib/ownership/invalidate-after-block";
import { ownershipMessages } from "@/lib/ownership/messages";

interface UseGroupActionsOptions {
  userId: string;
  group: Group | null | undefined;
  onDeleted?: () => void;
}

export function useGroupActions({ userId, group, onDeleted }: UseGroupActionsOptions) {
  const queryClient = useQueryClient();
  const groupId = group?.id ?? "";
  const isOwner = Boolean(group && userId && group.owner_id === userId);

  const [menuVisible, setMenuVisible] = useState(false);
  const [membersVisible, setMembersVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);

  const menuActions = useMemo(() => groupActionsForRole(isOwner), [isOwner]);

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ["group-members", groupId],
    queryFn: () => getGroupMembers(groupId),
    enabled: membersVisible && !!groupId,
  });

  const memberItems = useMemo(
    () =>
      members.map((entry) => ({
        id: entry.user_id,
        displayName: entry.profile?.display_name,
        username: entry.profile?.username,
        avatarUrl: entry.profile?.avatar_url,
      })),
    [members]
  );

  const closeMenu = useCallback(() => setMenuVisible(false), []);

  const openGroupActions = useCallback(() => {
    if (!group || !userId) return;
    setMenuVisible(true);
  }, [group, userId]);

  const deleteMutation = useMutation({
    mutationFn: () => deleteGroup(groupId, userId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["discover-groups"] });
      removeGroupFromLists(queryClient, groupId);
      queryClient.removeQueries({ queryKey: ["group", groupId] });
      queryClient.removeQueries({ queryKey: ["group-posts", groupId] });
      queryClient.removeQueries({ queryKey: ["group-members", groupId] });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["discover-groups"] });
      showSuccess(ownershipMessages.deleted("Group"));
      onDeleted?.();
    },
    onError: (error) => {
      void queryClient.invalidateQueries({ queryKey: ["discover-groups"] });
      showAlert("Something went wrong", getErrorMessage(error) || ownershipMessages.errorGeneric);
    },
  });

  const reportMutation = useMutation({
    mutationFn: (reason: string) => {
      if (!group) throw new Error("No group selected");
      return reportGroup(userId, group.id, group.owner_id, reason);
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
      if (!group) throw new Error("No group selected");
      return blockUser(userId, group.owner_id);
    },
    onSuccess: async () => {
      closeMenu();
      await invalidateAfterBlock(queryClient, userId);
      showSuccess(ownershipMessages.userBlocked);
    },
    onError: (error) => showAlert(ownershipMessages.blockFailed, getErrorMessage(error)),
  });

  const handleAction = useCallback(
    (actionId: EntityActionId) => {
      if (!group) return;

      const actions = groupActionsForRole(isOwner);
      if (isPlaceholderAction(actions, actionId)) {
        closeMenu();
        showAlert("Coming soon", "View Analytics will be available in a future update.");
        return;
      }

      switch (actionId) {
        case "edit":
          closeMenu();
          router.push({ pathname: "/edit-group/[id]", params: { id: group.id } });
          return;
        case "delete":
          closeMenu();
          confirmDeleteGroup(() => deleteMutation.mutate());
          return;
        case "share":
          closeMenu();
          void shareGroupLink(group.id, group.name);
          return;
        case "copy_link":
          closeMenu();
          void copyGroupLink(group.id);
          return;
        case "view_participants":
          closeMenu();
          setMembersVisible(true);
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
    [group, closeMenu, deleteMutation, blockMutation, isOwner]
  );

  const groupActionSheets = (
    <>
      <EntityActionSheet
        visible={menuVisible}
        title="Group options"
        actions={menuActions}
        onSelect={handleAction}
        onClose={closeMenu}
      />
      <EntityListSheet
        visible={membersVisible}
        title="Members"
        items={memberItems}
        loading={membersLoading}
        emptyMessage="No members yet."
        onClose={() => setMembersVisible(false)}
      />
      <ReportReasonSheet
        visible={reportVisible}
        title="Report group"
        onClose={() => setReportVisible(false)}
        onSelect={(reason) => reportMutation.mutate(reason)}
      />
    </>
  );

  return {
    openGroupActions,
    groupActionSheets,
    isOwner,
    isDeleting: deleteMutation.isPending,
  };
}
