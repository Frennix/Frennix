import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { subscribeToNotifications } from "@frennix/api";

export function useNotificationSubscription(userId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    function refreshNotifications() {
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
      queryClient.invalidateQueries({ queryKey: ["unread-notifications", userId] });
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
      channel?.unsubscribe();
    };
  }, [userId, queryClient]);
}
