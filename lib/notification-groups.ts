import type { Notification } from "@frennix/types";

export type NotificationSection = {
  key: string;
  title: string;
  data: Notification[];
};

function startOfLocalDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** Groups notifications into premium-style date sections. */
export function groupNotificationsByDate(notifications: Notification[]): NotificationSection[] {
  const now = new Date();
  const today = startOfLocalDay(now);
  const yesterday = addDays(today, -1);
  const weekAgo = addDays(today, -7);

  const buckets: Record<string, Notification[]> = {
    today: [],
    yesterday: [],
    week: [],
    earlier: [],
  };

  for (const notification of notifications) {
    const created = new Date(notification.created_at ?? 0);
    if (created >= today) buckets.today.push(notification);
    else if (created >= yesterday) buckets.yesterday.push(notification);
    else if (created >= weekAgo) buckets.week.push(notification);
    else buckets.earlier.push(notification);
  }

  const sections: NotificationSection[] = [];
  if (buckets.today.length) {
    sections.push({ key: "today", title: "Today", data: buckets.today });
  }
  if (buckets.yesterday.length) {
    sections.push({ key: "yesterday", title: "Yesterday", data: buckets.yesterday });
  }
  if (buckets.week.length) {
    sections.push({ key: "week", title: "This week", data: buckets.week });
  }
  if (buckets.earlier.length) {
    sections.push({ key: "earlier", title: "Earlier", data: buckets.earlier });
  }

  return sections;
}
