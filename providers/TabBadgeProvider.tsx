import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { getUnreadMessageCount, getUnreadNotificationCount } from "@frennix/api";
import { syncNotificationBadgeCount } from "@/lib/notifications";

type TabBadgeContextValue = {
  unreadNotifications: number;
  unreadMessages: number;
};

const TabBadgeContext = createContext<TabBadgeContextValue>({
  unreadNotifications: 0,
  unreadMessages: 0,
});

/** Single subscriber for tab/header badges — avoids duplicating queries across tab layout + headers. */
export function TabBadgeProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const { data: unreadNotifications = 0 } = useQuery({
    queryKey: ["unread-notifications", userId],
    queryFn: () => getUnreadNotificationCount(userId),
    enabled: !!userId,
    staleTime: 60_000,
    // Realtime subscription patches this cache; no polling interval.
  });

  const { data: unreadMessages = 0 } = useQuery({
    queryKey: ["unread-messages", userId],
    queryFn: () => getUnreadMessageCount(userId),
    enabled: !!userId,
    staleTime: 45_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (!userId) return;
    void syncNotificationBadgeCount(unreadNotifications);
  }, [userId, unreadNotifications]);

  const value = useMemo(
    () => ({ unreadNotifications, unreadMessages }),
    [unreadNotifications, unreadMessages]
  );

  return <TabBadgeContext.Provider value={value}>{children}</TabBadgeContext.Provider>;
}

export function useTabBadges() {
  return useContext(TabBadgeContext);
}
