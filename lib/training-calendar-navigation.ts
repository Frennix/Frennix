import type { Href } from "expo-router";
import type { CalendarViewItem, PartnerTrainingTodayEntry } from "@frennix/types";
import type { TodaysFocusData } from "@/lib/training-calendar-focus";
import { openCreatePost, pushScreen } from "@/lib/press-utils";
import { showAlert } from "@/lib/alerts";

export function openTrainingCalendarCreate(params?: Record<string, string>) {
  if (params && Object.keys(params).length > 0) {
    pushScreen({ pathname: "/training-calendar/create", params } as Href);
    return;
  }
  pushScreen("/training-calendar/create" as Href);
}

export function openTrainingCalendarDetail(itemId: string) {
  pushScreen(`/training-calendar/${itemId}` as Href);
}

export function openTrainingCalendarEdit(itemId: string) {
  pushScreen(`/training-calendar/edit/${itemId}` as Href);
}

export function openCommunityEventsBrowse() {
  pushScreen("/events/browse" as Href);
}

/** Open the correct destination for a native or virtual calendar row. */
export function openCalendarViewItem(item: CalendarViewItem) {
  if (item.is_virtual && item.deep_link) {
    pushScreen(item.deep_link as Href);
    return;
  }
  if (!item.is_virtual) {
    openTrainingCalendarDetail(item.id);
  }
}

/**
 * Primary Today's Focus CTA — open today's session or log a workout.
 */
export function startTodaysWorkout(focus: TodaysFocusData) {
  if (focus.todayItem && !focus.isRestDay && focus.todayItem.status !== "completed") {
    openCalendarViewItem(focus.todayItem);
    return;
  }

  if (focus.todayItem?.status === "completed") {
    openCreatePost();
    return;
  }

  if (focus.isRestDay) {
    openCreatePost();
    return;
  }

  if (!focus.todayItem) {
    openCreatePost();
    return;
  }

  openCalendarViewItem(focus.todayItem);
}

export function openPartnerTrainingSession(partner: PartnerTrainingTodayEntry) {
  openTrainingCalendarDetail(partner.session_id);
}

export function messagePartnerFromFocus(partner: PartnerTrainingTodayEntry) {
  if (partner.conversation_id) {
    pushScreen(`/chat/${partner.conversation_id}` as Href);
    return;
  }
  pushScreen(`/user/${partner.username}` as Href);
}

export function invitePartnerToTrainFromFocus(partner: PartnerTrainingTodayEntry) {
  openTrainingCalendarCreate({
    invitee_id: partner.user_id,
    item_type: "partner_workout",
  });
}

/** Open-session join flow — Calendar v1.1. */
export function joinPartnerTrainingSession(partner: PartnerTrainingTodayEntry) {
  if (!partner.can_join) return;
  showAlert(
    "Join workout",
    "Open session join is coming in Calendar v1.1. You can message or invite them to train for now."
  );
}
