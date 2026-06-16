import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { getUnreadNotificationCount } from "@frennix/api";
import { syncNotificationBadgeCount } from "@/lib/notifications";

export function useNotificationBadge(userId: string) {
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["unread-notifications", userId],
    queryFn: () => getUnreadNotificationCount(userId),
    enabled: !!userId,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!userId) return;
    void syncNotificationBadgeCount(unreadCount);
  }, [userId, unreadCount]);

  return unreadCount;
}
