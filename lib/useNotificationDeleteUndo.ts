import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  dismissNotification,
  dismissNotificationsBulk,
  getErrorMessage,
} from "@frennix/api";
import type { Notification } from "@frennix/types";
import { showAlert } from "@/lib/alerts";
import {
  removeNotificationFromPages,
  restoreNotificationsToPages,
  updateNotificationPages,
} from "@/lib/notification-query-cache";
import { syncNotificationBadgeCount } from "@/lib/notifications";

const DISMISS_ANIMATION_MS = 280;
export const NOTIFICATION_DELETE_UNDO_MS = 7000;

type PendingDelete = {
  notifications: Notification[];
  indices: Map<string, number>;
};

type UseNotificationDeleteUndoOptions = {
  userId: string;
  getNotificationsList: () => Notification[];
};

export function useNotificationDeleteUndo({
  userId,
  getNotificationsList,
}: UseNotificationDeleteUndoOptions) {
  const queryClient = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(() => new Set());
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<PendingDelete | null>(null);

  pendingRef.current = pendingDelete;

  const clearTimers = useCallback(() => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    if (animTimerRef.current) {
      clearTimeout(animTimerRef.current);
      animTimerRef.current = null;
    }
  }, []);

  const commitDelete = useCallback(
    async (ids: string[], restore?: PendingDelete) => {
      try {
        if (ids.length === 1) {
          await dismissNotification(ids[0], userId);
        } else {
          await dismissNotificationsBulk(ids, userId);
        }
      } catch (error) {
        if (restore) {
          restoreNotificationsToPages(queryClient, userId, restore.notifications);
          const unreadRestore = restore.notifications.filter((item) => !item.read_at).length;
          if (unreadRestore > 0) {
            queryClient.setQueryData<number>(["unread-notifications", userId], (current) =>
              (current ?? 0) + unreadRestore
            );
            const nextUnread =
              queryClient.getQueryData<number>(["unread-notifications", userId]) ?? 0;
            void syncNotificationBadgeCount(nextUnread);
          }
        }
        showAlert("Could not delete notification", getErrorMessage(error));
      }
    },
    [queryClient, userId]
  );

  const scheduleUndoWindow = useCallback(
    (pending: PendingDelete) => {
      setPendingDelete(pending);
      undoTimerRef.current = setTimeout(() => {
        setPendingDelete(null);
        void commitDelete(
          pending.notifications.map((item) => item.id),
          pending
        );
      }, NOTIFICATION_DELETE_UNDO_MS);
    },
    [commitDelete]
  );

  const undoDelete = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    clearTimers();
    restoreNotificationsToPages(queryClient, userId, pending.notifications);
    const unreadRestore = pending.notifications.filter((item) => !item.read_at).length;
    if (unreadRestore > 0) {
      queryClient.setQueryData<number>(["unread-notifications", userId], (current) =>
        (current ?? 0) + unreadRestore
      );
      const nextUnread = queryClient.getQueryData<number>(["unread-notifications", userId]) ?? 0;
      void syncNotificationBadgeCount(nextUnread);
    }
    setPendingDelete(null);
  }, [clearTimers, queryClient, userId]);

  const removeFromCache = useCallback(
    (notifications: Notification[]) => {
      let removedUnread = 0;
      for (const notification of notifications) {
        if (!notification.read_at) removedUnread += 1;
        removeNotificationFromPages(queryClient, userId, notification.id);
      }
      if (removedUnread > 0) {
        queryClient.setQueryData<number>(["unread-notifications", userId], (current) =>
          Math.max(0, (current ?? 0) - removedUnread)
        );
        const nextUnread = queryClient.getQueryData<number>(["unread-notifications", userId]) ?? 0;
        void syncNotificationBadgeCount(nextUnread);
      }
    },
    [queryClient, userId]
  );

  const requestDelete = useCallback(
    (notification: Notification) => {
      const existing = pendingRef.current;
      if (existing) {
        clearTimers();
        setPendingDelete(null);
        void commitDelete(existing.notifications.map((item) => item.id));
      }

      const list = getNotificationsList();
      const index = list.findIndex((item) => item.id === notification.id);
      const pending: PendingDelete = {
        notifications: [notification],
        indices: new Map([[notification.id, index >= 0 ? index : list.length]]),
      };

      setDismissingIds((current) => new Set(current).add(notification.id));
      animTimerRef.current = setTimeout(() => {
        removeFromCache([notification]);
        setDismissingIds((current) => {
          const next = new Set(current);
          next.delete(notification.id);
          return next;
        });
        scheduleUndoWindow(pending);
      }, DISMISS_ANIMATION_MS);
    },
    [clearTimers, commitDelete, getNotificationsList, removeFromCache, scheduleUndoWindow]
  );

  const requestBulkDelete = useCallback(
    (notifications: Notification[]) => {
      if (!notifications.length) return;
      const existing = pendingRef.current;
      if (existing) {
        clearTimers();
        setPendingDelete(null);
        void commitDelete(existing.notifications.map((item) => item.id));
      }

      const list = getNotificationsList();
      const indices = new Map<string, number>();
      for (const notification of notifications) {
        const index = list.findIndex((item) => item.id === notification.id);
        indices.set(notification.id, index >= 0 ? index : list.length);
      }

      const pending: PendingDelete = { notifications, indices };

      setDismissingIds((current) => {
        const next = new Set(current);
        for (const notification of notifications) next.add(notification.id);
        return next;
      });

      animTimerRef.current = setTimeout(() => {
        removeFromCache(notifications);
        setDismissingIds((current) => {
          const next = new Set(current);
          for (const notification of notifications) next.delete(notification.id);
          return next;
        });
        scheduleUndoWindow(pending);
      }, DISMISS_ANIMATION_MS);
    },
    [clearTimers, commitDelete, getNotificationsList, removeFromCache, scheduleUndoWindow]
  );

  useEffect(() => clearTimers, [clearTimers]);

  const isDismissing = useCallback((id: string) => dismissingIds.has(id), [dismissingIds]);

  const markReadOnly = useCallback(
    (notificationId: string) => {
      const readAt = new Date().toISOString();
      updateNotificationPages(queryClient, userId, (items) =>
        items.map((item) => (item.id === notificationId ? { ...item, read_at: readAt } : item))
      );
    },
    [queryClient, userId]
  );

  return {
    pendingDelete,
    requestDelete,
    requestBulkDelete,
    undoDelete,
    isDismissing,
    markReadOnly,
  };
}
