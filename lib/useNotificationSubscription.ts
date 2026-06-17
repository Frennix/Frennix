import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { subscribeToNotifications } from "@frennix/api";

export function useNotificationSubscription(userId: string) {
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    try {
      channel = subscribeToNotifications(userId, {
        onInsert: refreshNotifications,
        onUpdate: refreshNotifications,
      });
    } catch (error) {
      console.warn("[notifications] realtime subscription failed", error);
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      channel?.unsubscribe();
    };
  }, [userId, queryClient]);
}
