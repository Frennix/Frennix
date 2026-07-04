import type { CalendarViewItem, PartnerTrainingTodayEntry } from "@frennix/types";
import {
  calendarItemIcon,
  calendarItemLabel,
  formatSessionTime,
  toDateKey,
} from "@/lib/training-calendar-utils";

export type TodaysFocusData = {
  todayKey: string;
  todayHeadline: string;
  todaySubline: string | null;
  isRestDay: boolean;
  todayItem: CalendarViewItem | null;
  streak: number;
  weeklyCompleted: number;
  weeklyScheduled: number;
  weeklyProgressLabel: string;
  nextItem: CalendarViewItem | null;
  nextLabel: string | null;
  startWorkoutLabel: string;
  partnersTrainingToday: PartnerTrainingTodayEntry[];
};

function isWorkoutItem(item: CalendarViewItem): boolean {
  return item.item_type !== "rest_day";
}

function itemsForDate(items: CalendarViewItem[], dateKey: string): CalendarViewItem[] {
  return items
    .filter((item) => item.scheduled_date.slice(0, 10) === dateKey)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

function formatNextLabel(item: CalendarViewItem): string {
  const dateKey = item.scheduled_date.slice(0, 10);
  const todayKey = toDateKey(new Date());
  const dayLabel =
    dateKey === todayKey
      ? "Today"
      : new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
  const time = formatSessionTime(item.starts_at, item.ends_at);
  return `${item.title} · ${dayLabel} ${time}`;
}

/** Derive Today's Focus from calendar view data — updates automatically each day. */
export function buildTodaysFocus(
  items: CalendarViewItem[],
  streak: number,
  weekly: { scheduled: number; completed: number; missed: number } | undefined,
  partnersTrainingToday: PartnerTrainingTodayEntry[] = [],
  now = new Date()
): TodaysFocusData {
  const todayKey = toDateKey(now);
  const todayItems = itemsForDate(items, todayKey);
  const restDayItem = todayItems.find((item) => item.item_type === "rest_day") ?? null;
  const todayWorkouts = todayItems.filter(isWorkoutItem);

  let todayItem: CalendarViewItem | null = null;
  let todayHeadline = "No workout scheduled";
  let todaySubline: string | null = "Add a session or start logging when you are ready.";
  let isRestDay = false;

  if (restDayItem && todayWorkouts.length === 0) {
    isRestDay = true;
    todayItem = restDayItem;
    todayHeadline = "Rest Day";
    todaySubline = "Recovery is part of the plan. Log an activity if you still move today.";
  } else if (todayWorkouts.length > 0) {
    const active =
      todayWorkouts.find((item) => item.status === "scheduled") ??
      todayWorkouts.find((item) => item.status === "completed") ??
      todayWorkouts[0];
    todayItem = active;
    const icon = calendarItemIcon(active.item_type);
    todayHeadline = `${icon} ${active.title}`;
    todaySubline = `${calendarItemLabel(active.item_type)} · ${formatSessionTime(
      active.starts_at,
      active.ends_at
    )}`;
    if (active.status === "completed") {
      todaySubline = `Completed · ${todaySubline}`;
    }
  }

  const weeklyScheduled = weekly?.scheduled ?? 0;
  const weeklyCompleted = weekly?.completed ?? 0;
  const weeklyProgressLabel =
    weeklyScheduled > 0
      ? `${weeklyCompleted} of ${weeklyScheduled} workouts completed`
      : weeklyCompleted > 0
        ? `${weeklyCompleted} workout${weeklyCompleted === 1 ? "" : "s"} completed this week`
        : "No workouts scheduled this week";

  const upcoming = items
    .filter(
      (item) =>
        isWorkoutItem(item) &&
        item.status === "scheduled" &&
        new Date(item.starts_at).getTime() > now.getTime()
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  let nextItem = upcoming[0] ?? null;
  if (nextItem && todayItem && nextItem.id === todayItem.id) {
    nextItem = upcoming[1] ?? null;
  }

  let startWorkoutLabel = "Start Workout";
  if (isRestDay) {
    startWorkoutLabel = "Log Activity";
  } else if (todayItem?.status === "completed") {
    startWorkoutLabel = "Log Workout";
  } else if (!todayItem) {
    startWorkoutLabel = "Start Workout";
  }

  return {
    todayKey,
    todayHeadline,
    todaySubline,
    isRestDay,
    todayItem,
    streak,
    weeklyCompleted,
    weeklyScheduled,
    weeklyProgressLabel,
    nextItem,
    nextLabel: nextItem ? formatNextLabel(nextItem) : null,
    startWorkoutLabel,
    partnersTrainingToday,
  };
}
