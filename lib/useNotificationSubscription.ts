import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
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

export function useNotificationSubscription(userId: string) {
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId) return;

    function refreshNotifications() {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
        queryClient.invalidateQueries({ queryKey: ["unread-notifications", userId] });
      }, 350);
    }

    let channel: ReturnType<typeof subscribeToNotifications> | null = null;

    function connect() {
      channel?.unsubscribe();
      channel = null;

      try {
        channel = subscribeToNotifications(userId, {
          onInsert: refreshNotifications,
          onUpdate: refreshNotifications,
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
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      channel?.unsubscribe();
    };
  }, [userId, queryClient]);
}
