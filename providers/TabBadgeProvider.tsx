import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname } from "expo-router";
import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { getUnreadMessageCount, getUnreadNotificationCount } from "@frennix/api";
import type { Conversation } from "@frennix/types";
import { syncNotificationBadgeCount } from "@/lib/notifications";

type TabBadgeContextValue = {
  unreadNotifications: number;
  unreadMessages: number;
};

const TabBadgeContext = createContext<TabBadgeContextValue>({
  unreadNotifications: 0,
  unreadMessages: 0,
});

function sumUnreadFromConversations(conversations: Conversation[] | undefined) {
  if (!conversations) return null;
  return conversations.reduce((total, conversation) => total + (conversation.unread_count ?? 0), 0);
}

/** Single subscriber for tab/header badges — avoids duplicating queries across tab layout + headers. */
export function TabBadgeProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const messagesRouteActive =
    pathname === "/messages" || pathname.startsWith("/chat/") || pathname.includes("/messages");

  const { data: unreadNotifications = 0 } = useQuery({
    queryKey: ["unread-notifications", userId],
    queryFn: () => getUnreadNotificationCount(userId),
    enabled: !!userId,
    staleTime: 60_000,
    networkMode: "offlineFirst",
    // Realtime subscription patches this cache; no polling interval.
  });

  const { data: unreadMessages = 0 } = useQuery({
    queryKey: ["unread-messages", userId],
    queryFn: () => getUnreadMessageCount(userId),
    enabled: !!userId,
    staleTime: 45_000,
    networkMode: "offlineFirst",
    refetchInterval: (query) => {
      if (!messagesRouteActive) return false;
      const inboxState = queryClient.getQueryState(["conversations", userId]);
      if (
        inboxState?.dataUpdatedAt &&
        Date.now() - inboxState.dataUpdatedAt < 50_000 &&
        inboxState.data
      ) {
        return false;
      }
      return query.state.dataUpdatedAt ? 60_000 : false;
    },
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (!userId || !messagesRouteActive) return;

    const syncUnreadFromInbox = () => {
      const conversations = queryClient.getQueryData<Conversation[]>(["conversations", userId]);
      const derived = sumUnreadFromConversations(conversations);
      if (derived === null) return;
      queryClient.setQueryData(["unread-messages", userId], derived);
    };

    syncUnreadFromInbox();
    return queryClient.getQueryCache().subscribe((event) => {
      if (
        event.type !== "updated" ||
        event.query.queryKey[0] !== "conversations" ||
        event.query.queryKey[1] !== userId
      ) {
        return;
      }
      syncUnreadFromInbox();
    });
  }, [messagesRouteActive, queryClient, userId]);

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
