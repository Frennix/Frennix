import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import type { Notification } from "@frennix/types";
import type { NotificationCategory } from "@frennix/notifications";

export type NotificationListCategory = NotificationCategory | "all";

export type NotificationPageResult = {
  items: Notification[];
  nextCursor: string | null;
};

export type NotificationsInfiniteKey = [
  "notifications",
  string,
  { category: NotificationListCategory },
];

export function notificationsQueryKey(
  userId: string,
  category: NotificationListCategory = "all"
): NotificationsInfiniteKey {
  return ["notifications", userId, { category }];
}

export function flattenNotificationPages(
  data: InfiniteData<NotificationPageResult> | undefined
): Notification[] {
  if (!data?.pages.length) return [];
  const seen = new Set<string>();
  const merged: Notification[] = [];

  for (const page of data.pages) {
    for (const item of page.items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      merged.push(item);
    }
  }

  return merged;
}

export function updateNotificationPages(
  queryClient: QueryClient,
  userId: string,
  updater: (items: Notification[]) => Notification[]
) {
  queryClient.setQueriesData<InfiniteData<NotificationPageResult>>(
    { queryKey: ["notifications", userId] },
    (current) => {
      if (!current) return current;
      return {
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          items: updater(page.items),
        })),
      };
    }
  );
}

export function prependNotificationToPages(
  queryClient: QueryClient,
  userId: string,
  notification: Notification
) {
  queryClient.setQueriesData<InfiniteData<NotificationPageResult>>(
    { queryKey: ["notifications", userId] },
    (current) => {
      if (!current?.pages.length) return current;
      const [first, ...rest] = current.pages;
      if (first.items.some((item) => item.id === notification.id)) {
        return current;
      }
      return {
        ...current,
        pages: [{ ...first, items: [notification, ...first.items] }, ...rest],
      };
    }
  );
}

export function removeNotificationFromPages(
  queryClient: QueryClient,
  userId: string,
  notificationId: string
) {
  updateNotificationPages(queryClient, userId, (items) =>
    items.filter((item) => item.id !== notificationId)
  );
}

export function clearNotificationPages(queryClient: QueryClient, userId: string) {
  queryClient.setQueriesData<InfiniteData<NotificationPageResult>>(
    { queryKey: ["notifications", userId] },
    (current) => {
      if (!current) return current;
      return {
        ...current,
        pages: current.pages.map((page) => ({ ...page, items: [] })),
      };
    }
  );
}
