import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { subscribeToNotifications } from "@frennix/api";

export function useNotificationSubscription(userId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const channel = subscribeToNotifications(userId, () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
      queryClient.invalidateQueries({ queryKey: ["unread-notifications", userId] });
    });

    return () => {
      channel.unsubscribe();
    };
  }, [userId, queryClient]);
}
