import type { CalendarViewItem, TrainingCalendarItemType } from "@frennix/types";
import { TRAINING_CALENDAR_ITEM_TYPES } from "@frennix/types";

export function calendarItemIcon(type: TrainingCalendarItemType): string {
  return TRAINING_CALENDAR_ITEM_TYPES.find((entry) => entry.value === type)?.icon ?? "📌";
}

export function calendarItemLabel(type: TrainingCalendarItemType): string {
  return TRAINING_CALENDAR_ITEM_TYPES.find((entry) => entry.value === type)?.label ?? "Session";
}

export function toDateKey(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfWeek(date: Date): Date {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(date, diff);
}

export function endOfWeek(date: Date): Date {
  return addDays(startOfWeek(date), 6);
}

export type CalendarDayCell = {
  date: Date;
  dateKey: string;
  inMonth: boolean;
  isToday: boolean;
  items: CalendarViewItem[];
  hasActivity?: boolean;
};

export function buildMonthGrid(
  anchor: Date,
  items: CalendarViewItem[],
  activityDateKeys: Set<string> = new Set(),
  today = new Date()
): CalendarDayCell[] {
  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = addDays(startOfWeek(monthEnd), 6);

  const itemsByDate = new Map<string, CalendarViewItem[]>();
  for (const item of items) {
    const key = item.scheduled_date.slice(0, 10);
    const list = itemsByDate.get(key) ?? [];
    list.push(item);
    itemsByDate.set(key, list);
  }

  const cells: CalendarDayCell[] = [];
  let cursor = new Date(gridStart);

  while (cursor <= gridEnd) {
    const dateKey = toDateKey(cursor);
    cells.push({
      date: new Date(cursor),
      dateKey,
      inMonth: cursor.getMonth() === anchor.getMonth(),
      isToday: toDateKey(today) === dateKey,
      items: itemsByDate.get(dateKey) ?? [],
      hasActivity: activityDateKeys.has(dateKey),
    });
    cursor = addDays(cursor, 1);
  }

  return cells;
}

export function buildWeekDays(
  anchor: Date,
  items: CalendarViewItem[],
  activityDateKeys: Set<string> = new Set(),
  today = new Date()
): CalendarDayCell[] {
  const weekStart = startOfWeek(anchor);
  const itemsByDate = new Map<string, CalendarViewItem[]>();
  for (const item of items) {
    const key = item.scheduled_date.slice(0, 10);
    const list = itemsByDate.get(key) ?? [];
    list.push(item);
    itemsByDate.set(key, list);
  }

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    const dateKey = toDateKey(date);
    return {
      date,
      dateKey,
      inMonth: true,
      isToday: toDateKey(today) === dateKey,
      items: itemsByDate.get(dateKey) ?? [],
      hasActivity: activityDateKeys.has(dateKey),
    };
  });
}

export function monthLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function weekLabel(date: Date): string {
  const start = startOfWeek(date);
  const end = endOfWeek(date);
  const startText = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endText = end.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${startText} – ${endText}`;
}

export function formatSessionTime(startsAt: string, endsAt?: string | null): string {
  const start = new Date(startsAt);
  const startText = start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (!endsAt) return startText;
  const end = new Date(endsAt);
  const endText = end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${startText} – ${endText}`;
}

export function statusColor(status: CalendarViewItem["status"]): string {
  switch (status) {
    case "completed":
      return "#22C55E";
    case "missed":
      return "#EF4444";
    case "rescheduled":
      return "#F59E0B";
    default:
      return "#71717A";
  }
}
