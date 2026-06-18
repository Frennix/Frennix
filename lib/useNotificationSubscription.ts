import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import type { Notification } from "@frennix/types";
import { subscribeToNotifications } from "@frennix/api";

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

export function useNotificationSubscription(userId: string) {
  const queryClient = useQueryClient();
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId) return;

    function handleInsert(notification: Notification) {
      queryClient.setQueryData<Notification[]>(["notifications", userId], (current) =>
        prependNotification(current, notification)
      );
      queryClient.setQueryData<number>(["unread-notifications", userId], (current) =>
        (current ?? 0) + 1
      );
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
