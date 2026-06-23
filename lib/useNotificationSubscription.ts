import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import type { Notification } from "@frennix/types";
import { getProfilesByIds, notificationActorId, subscribeToNotifications } from "@frennix/api";

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

function prependNotification(
  current: Notification[] | undefined,
  notification: Notification
): Notification[] | undefined {
  if (!current) return current;
  if (current.some((item) => item.id === notification.id)) return current;
  return [notification, ...current];
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
        queryClient.setQueryData<Notification[]>(["notifications", userId], (current) =>
          prependNotification(current, enriched)
        );
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
      });
    }

    function handleUpdate(notification: Notification) {
      queryClient.setQueryData<Notification[]>(["notifications", userId], (current) =>
        current?.map((item) => (item.id === notification.id ? { ...item, ...notification } : item))
      );
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
