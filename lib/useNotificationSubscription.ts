import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import type { Notification } from "@frennix/types";
import { getProfilesByIds, notificationActorId, subscribeToNotifications } from "@frennix/api";
import { maybeRequestNotificationOnboardingFromActivity } from "@/lib/notification-onboarding";
import {
  prependNotificationToPages,
  removeNotificationFromPages,
  updateNotificationPages,
} from "@/lib/notification-query-cache";

function attachVisibilityReconnect(resubscribe: () => void): () => void {
  if (Platform.OS === "web" && typeof document !== "undefined") {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        resubscribe();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }

  const subscription = AppState.addEventListener("change", (nextState) => {
    if (nextState === "active") {
      resubscribe();
    }
  });
  return () => subscription.remove();
}

async function enrichNotification(notification: Notification): Promise<Notification> {
  const actorId = notificationActorId(notification);
  if (!actorId) return notification;

  const profiles = await getProfilesByIds([actorId]);
  const actor = profiles[0];
  return actor ? { ...notification, actor } : notification;
}

export function useNotificationSubscription(userId: string) {
  const queryClient = useQueryClient();
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId) return;

    function handleInsert(notification: Notification) {
      void enrichNotification(notification).then((enriched) => {
        prependNotificationToPages(queryClient, userId, enriched);
        queryClient.setQueryData<number>(["unread-notifications", userId], (current) =>
          (current ?? 0) + 1
        );

        if (enriched.type === "match") {
          queryClient.invalidateQueries({ queryKey: ["training-matches", userId] });
        }

        if (enriched.type === "message") {
          queryClient.invalidateQueries({ queryKey: ["conversations", userId] });
          queryClient.invalidateQueries({ queryKey: ["unread-messages", userId] });
        }

        void maybeRequestNotificationOnboardingFromActivity(enriched.type, {
          userId,
          queryClient,
        });
      });
    }

    function handleUpdate(notification: Notification) {
      if (notification.deleted_at) {
        removeNotificationFromPages(queryClient, userId, notification.id);
        void queryClient.invalidateQueries({ queryKey: ["unread-notifications", userId] });
        return;
      }

      const cachedQueries = queryClient.getQueriesData({
        queryKey: ["notifications", userId],
      });
      let prior: Notification | undefined;
      for (const [, data] of cachedQueries) {
        const pages = (data as { pages?: { items: Notification[] }[] } | undefined)?.pages;
        if (!pages) continue;
        for (const page of pages) {
          prior = page.items.find((item) => item.id === notification.id);
          if (prior) break;
        }
        if (prior) break;
      }

      updateNotificationPages(queryClient, userId, (items) =>
        items.map((item) => (item.id === notification.id ? { ...item, ...notification } : item))
      );

      if (prior && !prior.read_at && notification.read_at) {
        queryClient.setQueryData<number>(["unread-notifications", userId], (current) =>
          Math.max(0, (current ?? 0) - 1)
        );
      } else if (prior?.read_at && !notification.read_at) {
        queryClient.setQueryData<number>(["unread-notifications", userId], (current) =>
          (current ?? 0) + 1
        );
      }
    }

    let channel: ReturnType<typeof subscribeToNotifications> | null = null;

    function connect() {
      channel?.unsubscribe();
      channel = null;

      try {
        channel = subscribeToNotifications(userId, {
          onInsert: handleInsert,
          onUpdate: handleUpdate,
        });
      } catch (error) {
        console.warn("[notifications] realtime subscription failed", error);
      }
    }

    function scheduleReconnect() {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        connect();
      }, 500);
    }

    connect();
    const detachVisibility = attachVisibilityReconnect(scheduleReconnect);

    return () => {
      detachVisibility();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      channel?.unsubscribe();
    };
  }, [userId, queryClient]);
}
