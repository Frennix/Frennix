import type { Href } from "expo-router";
import type { CalendarViewItem } from "@frennix/types";
import { pushScreen } from "@/lib/press-utils";

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
