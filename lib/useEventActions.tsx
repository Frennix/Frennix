import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import type { WorkoutEvent } from "@frennix/types";
import {
  blockUser,
  cancelWorkoutEvent,
  getErrorMessage,
  getEventAttendees,
  reportEvent,
} from "@frennix/api";
import { EntityActionSheet } from "@/components/EntityActionSheet";
import { EntityListSheet } from "@/components/EntityListSheet";
import { ReportReasonSheet } from "@/components/ReportReasonSheet";
import { type EntityActionId } from "@/lib/entity-actions";
import { eventActionsForRole } from "@/lib/event-actions";
import { copyEventLink, shareEventLink } from "@/lib/event-link";
import { confirmBlockUser, confirmCancelEvent, showAlert, showSuccess } from "@/lib/alerts";
import {
  markEventCancelledInCache,
  removeEventFromLists,
} from "@/lib/entity-list-cache";
import { invalidateAfterBlock } from "@/lib/ownership/invalidate-after-block";
import { ownershipMessages } from "@/lib/ownership/messages";

interface UseEventActionsOptions {
  userId: string;
  event: WorkoutEvent | null | undefined;
  onCancelled?: () => void;
}

export function useEventActions({ userId, event, onCancelled }: UseEventActionsOptions) {
  const queryClient = useQueryClient();
  const eventId = event?.id ?? "";
  const isOwner = Boolean(event && userId && event.created_by === userId);

  const [menuVisible, setMenuVisible] = useState(false);
  const [attendeesVisible, setAttendeesVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);

  const menuActions = useMemo(
    () => eventActionsForRole(isOwner, event),
    [isOwner, event]
  );

  const { data: attendees = [], isLoading: attendeesLoading } = useQuery({
    queryKey: ["event-attendees", eventId],
    queryFn: () => getEventAttendees(eventId),
    enabled: attendeesVisible && !!eventId,
  });

  const attendeeItems = useMemo(
    () =>
      attendees.map((profile) => ({
        id: profile.id,
        displayName: profile.display_name,
        username: profile.username,
        avatarUrl: profile.avatar_url,
      })),
    [attendees]
  );

  const cancelMutation = useMutation({
    mutationFn: () => cancelWorkoutEvent(eventId, userId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["workout-events", userId] });
      removeEventFromLists(queryClient, eventId, userId);
      markEventCancelledInCache(queryClient, eventId, userId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["workout-events"] });
      showSuccess(ownershipMessages.cancelled("Event"));
      onCancelled?.();
    },
    onError: (error) => {
      void queryClient.invalidateQueries({ queryKey: ["workout-events", userId] });
      void queryClient.invalidateQueries({ queryKey: ["workout-event", eventId, userId] });
      showAlert("Something went wrong", getErrorMessage(error) || ownershipMessages.errorGeneric);
    },
  });

  const reportMutation = useMutation({
    mutationFn: (reason: string) => {
      if (!event) throw new Error("No event selected");
      return reportEvent(userId, event.id, event.created_by, reason);
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
      if (!event) throw new Error("No event selected");
      return blockUser(userId, event.created_by);
    },
    onSuccess: async () => {
      closeMenu();
      await invalidateAfterBlock(queryClient, userId);
      showSuccess(ownershipMessages.userBlocked);
    },
    onError: (error) => showAlert(ownershipMessages.blockFailed, getErrorMessage(error)),
  });

  const openEventActions = useCallback(() => {
    if (!event || !userId) return;
    setMenuVisible(true);
  }, [event, userId]);

  const closeMenu = useCallback(() => setMenuVisible(false), []);

  const handleAction = useCallback(
    (actionId: EntityActionId) => {
      if (!event) return;

      switch (actionId) {
        case "edit":
          closeMenu();
          router.push({ pathname: "/edit-event/[id]", params: { id: event.id } });
          return;
        case "cancel":
          closeMenu();
          confirmCancelEvent(() => cancelMutation.mutate());
          return;
        case "share":
          closeMenu();
          void shareEventLink(event.id, event.title);
          return;
        case "copy_link":
          closeMenu();
          void copyEventLink(event.id);
          return;
        case "view_participants":
          closeMenu();
          setAttendeesVisible(true);
          return;
        case "view_analytics":
          closeMenu();
          showAlert("Coming soon", "View Analytics will be available in a future update.");
          return;
        case "invite":
          closeMenu();
          router.push(`/event/${event.id}/invite`);
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
    [event, closeMenu, cancelMutation, blockMutation]
  );

  const eventActionSheets = (
    <>
      <EntityActionSheet
        visible={menuVisible}
        title="Event options"
        actions={menuActions}
        onSelect={handleAction}
        onClose={closeMenu}
      />
      <EntityListSheet
        visible={attendeesVisible}
        title="Attendees"
        items={attendeeItems}
        loading={attendeesLoading}
        emptyMessage="No attendees yet."
        onClose={() => setAttendeesVisible(false)}
      />
      <ReportReasonSheet
        visible={reportVisible}
        title="Report event"
        onClose={() => setReportVisible(false)}
        onSelect={(reason) => reportMutation.mutate(reason)}
      />
    </>
  );

  return {
    openEventActions,
    eventActionSheets,
    isOwner,
    isCancelling: cancelMutation.isPending,
  };
}
