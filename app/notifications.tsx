import { memo, useCallback, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { frennixRefreshControlProps } from "@/lib/screen-shell";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getErrorMessage,
  getNotificationsPage,
  markAllNotificationsRead,
  markNotificationRead,
  dismissNotification,
  dismissNotificationsBulk,
  dismissAllNotifications,
} from "@frennix/api";
import type { Notification } from "@frennix/types";
import { useAuth } from "@/providers/AuthProvider";
import { openNotificationTargetAsync } from "@/lib/notification-navigation";
import { useGuardedRefresh } from "@/lib/useGuardedRefresh";
import { useTabBadges } from "@/providers/TabBadgeProvider";
import { showAlert, confirmBulkDismissNotifications } from "@/lib/alerts";
import { useDismissWithAnimation } from "@/lib/useDismissWithAnimation";
import { syncNotificationBadgeCount } from "@/lib/notifications";
import { AnimatedDismissRow } from "@/components/AnimatedDismissRow";
import { SwipeToDeleteRow } from "@/components/SwipeToDeleteRow";
import { NotificationsListSkeleton } from "@/components/NotificationsListSkeleton";
import { NotificationsPageFooterSkeleton } from "@/components/NotificationsPageFooterSkeleton";
import {
  NotificationFilterBar,
  type NotificationFilterId,
} from "@/components/NotificationFilterBar";
import { EmptyState, QueryErrorState, ScreenSpinner, colors, spacing, typography } from "@frennix/ui";
import { FrennixLogo } from "@/components/FrennixLogo";
import { FrennixNotificationRow } from "@/components/FrennixNotificationRow";
import { groupNotificationsByDate } from "@/lib/notification-groups";
import {
  clearNotificationPages,
  flattenNotificationPages,
  notificationsQueryKey,
  removeNotificationFromPages,
  updateNotificationPages,
} from "@/lib/notification-query-cache";

const FILTER_EMPTY_COPY: Record<
  NotificationFilterId,
  { title: string; description: string; icon: string }
> = {
  all: {
    icon: "🔔",
    title: "All caught up",
    description:
      "When you connect with a training partner, receive a message, or get activity on your posts, you'll see it here instantly.",
  },
  messages: {
    icon: "💬",
    title: "No messages yet",
    description: "Direct messages and training partner chats will appear here.",
  },
  social: {
    icon: "✨",
    title: "No social activity",
    description: "Likes, comments, follows, matches, and story interactions show up here.",
  },
  events: {
    icon: "📅",
    title: "No event updates",
    description: "Event invites, RSVPs, and training session reminders appear here.",
  },
  challenges: {
    icon: "🏆",
    title: "No challenge updates",
    description: "Challenge invites and progress updates will show here.",
  },
  system: {
    icon: "📣",
    title: "No announcements",
    description: "App updates and system announcements from Frennix appear here.",
  },
};

const SafeNotificationRow = memo(function SafeNotificationRow({
  notification,
  onPress,
  onDelete,
  dismissing,
  selectMode = false,
  selected = false,
  onToggleSelect,
}: {
  notification: Notification;
  onPress: (id: string) => void;
  onDelete: (notification: Notification) => void;
  dismissing: boolean;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  if (selectMode) {
    return (
      <Pressable
        style={[styles.selectRow, selected && styles.selectRowSelected]}
        onPress={() => onToggleSelect?.(notification.id)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
      >
        <View style={[styles.selectBox, selected && styles.selectBoxChecked]}>
          {selected ? <Text style={styles.selectCheck}>✓</Text> : null}
        </View>
        <View style={styles.selectRowContent}>
          <FrennixNotificationRow
            notification={notification}
            onPress={() => onToggleSelect?.(notification.id)}
            onDelete={() => onToggleSelect?.(notification.id)}
            hideDelete
          />
        </View>
      </Pressable>
    );
  }

  return (
    <AnimatedDismissRow dismissing={dismissing}>
      <SwipeToDeleteRow onDelete={() => onDelete(notification)}>
        <FrennixNotificationRow
          notification={notification}
          onPress={() => onPress(notification.id)}
          onDelete={() => onDelete(notification)}
        />
      </SwipeToDeleteRow>
    </AnimatedDismissRow>
  );
});

export default function NotificationsScreen() {
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user.id ?? "";
  const notificationsReady = !authLoading && !!userId;
  const queryClient = useQueryClient();
  const { unreadNotifications: unreadCount } = useTabBadges();
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [activeFilter, setActiveFilter] = useState<NotificationFilterId>("all");

  const queryKey = notificationsQueryKey(userId, activeFilter);
  const cachedPages = queryClient.getQueryData(queryKey);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) =>
      getNotificationsPage(userId, {
        cursor: pageParam,
        category: activeFilter,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: notificationsReady,
    staleTime: 60_000,
    placeholderData: (previous) => previous ?? cachedPages,
  });

  const notifications = useMemo(() => flattenNotificationPages(data), [data]);

  const notificationSections = useMemo(
    () => groupNotificationsByDate(notifications),
    [notifications]
  );

  const onRefresh = useGuardedRefresh(
    useCallback(() => refetch(), [refetch]),
    { errorTitle: "Could not refresh notifications" }
  );

  const handleFilterChange = useCallback((filter: NotificationFilterId) => {
    setActiveFilter(filter);
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const readMutation = useMutation({
    mutationFn: markNotificationRead,
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: ["notifications", userId] });
      updateNotificationPages(queryClient, userId, (items) =>
        items.map((item) =>
          item.id === notificationId ? { ...item, read_at: new Date().toISOString() } : item
        )
      );
      queryClient.setQueryData<number>(["unread-notifications", userId], (current) =>
        Math.max(0, (current ?? 0) - 1)
      );
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
      void queryClient.invalidateQueries({ queryKey: ["unread-notifications", userId] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(userId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["notifications", userId] });
      const readAt = new Date().toISOString();
      updateNotificationPages(queryClient, userId, (items) =>
        items.map((item) => ({ ...item, read_at: item.read_at ?? readAt }))
      );
      queryClient.setQueryData(["unread-notifications", userId], 0);
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
      void queryClient.invalidateQueries({ queryKey: ["unread-notifications", userId] });
    },
    onSuccess: () => {
      void syncNotificationBadgeCount(0);
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (notificationId: string) => dismissNotification(notificationId, userId),
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: ["notifications", userId] });
      let removedWasUnread = false;
      const cachedQueries = queryClient.getQueriesData({ queryKey: ["notifications", userId] });
      for (const [, pageData] of cachedQueries) {
        const pages = (pageData as { pages?: { items: Notification[] }[] } | undefined)?.pages;
        if (!pages) continue;
        for (const page of pages) {
          const removed = page.items.find((item) => item.id === notificationId);
          if (removed && !removed.read_at) {
            removedWasUnread = true;
            break;
          }
        }
      }
      removeNotificationFromPages(queryClient, userId, notificationId);
      if (removedWasUnread) {
        queryClient.setQueryData<number>(["unread-notifications", userId], (current) =>
          Math.max(0, (current ?? 0) - 1)
        );
      }
      return { removedWasUnread };
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
      void queryClient.invalidateQueries({ queryKey: ["unread-notifications", userId] });
    },
    onSuccess: (_data, _id, context) => {
      if (context?.removedWasUnread) {
        const nextUnread = Math.max(
          0,
          queryClient.getQueryData<number>(["unread-notifications", userId]) ?? 0
        );
        void syncNotificationBadgeCount(nextUnread);
      }
    },
  });

  const { requestDismiss: requestNotificationDismiss, isDismissing: isNotificationDismissing } =
    useDismissWithAnimation((notificationId) => dismissMutation.mutate(notificationId));

  const clearAllMutation = useMutation({
    mutationFn: () => dismissAllNotifications(userId),
    onSuccess: () => {
      clearNotificationPages(queryClient, userId);
      queryClient.setQueryData(["unread-notifications", userId], 0);
      void syncNotificationBadgeCount(0);
      setSelectMode(false);
      setSelectedIds(new Set());
    },
    onError: (mutationError) => {
      showAlert("Could not clear notifications", getErrorMessage(mutationError));
    },
  });

  const bulkDismissMutation = useMutation({
    mutationFn: (ids: string[]) => dismissNotificationsBulk(ids, userId),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: ["notifications", userId] });
      const idSet = new Set(ids);
      let removedUnread = 0;
      const cachedQueries = queryClient.getQueriesData({ queryKey: ["notifications", userId] });
      for (const [, pageData] of cachedQueries) {
        const pages = (pageData as { pages?: { items: Notification[] }[] } | undefined)?.pages;
        if (!pages) continue;
        for (const page of pages) {
          removedUnread += page.items.filter((item) => idSet.has(item.id) && !item.read_at).length;
        }
      }
      updateNotificationPages(queryClient, userId, (items) =>
        items.filter((item) => !idSet.has(item.id))
      );
      if (removedUnread > 0) {
        queryClient.setQueryData<number>(["unread-notifications", userId], (current) =>
          Math.max(0, (current ?? 0) - removedUnread)
        );
      }
      return { removedUnread };
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
      void queryClient.invalidateQueries({ queryKey: ["unread-notifications", userId] });
    },
    onSuccess: (_data, _ids, context) => {
      if (context?.removedUnread) {
        const nextUnread = Math.max(
          0,
          queryClient.getQueryData<number>(["unread-notifications", userId]) ?? 0
        );
        void syncNotificationBadgeCount(nextUnread);
      }
      setSelectMode(false);
      setSelectedIds(new Set());
    },
  });

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleBulkDelete = useCallback(() => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    confirmBulkDismissNotifications(ids.length, () => bulkDismissMutation.mutate(ids));
  }, [bulkDismissMutation, selectedIds]);

  const handleDeleteNotification = useCallback(
    (notification: Notification) => {
      requestNotificationDismiss(notification.id);
    },
    [requestNotificationDismiss]
  );

  const handlePressById = useCallback(
    async (notificationId: string) => {
      const notification = notifications.find((item) => item.id === notificationId);
      if (!notification) return;

      if (!notification.read_at) {
        readMutation.mutate(notification.id);
      }

      const result = await openNotificationTargetAsync(notification, userId);
      if (!result.ok) {
        showAlert("Unavailable", result.message);
      }
    },
    [notifications, readMutation, userId]
  );

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: Notification }) => (
      <SafeNotificationRow
        notification={item}
        onPress={handlePressById}
        onDelete={handleDeleteNotification}
        dismissing={isNotificationDismissing(item.id)}
        selectMode={selectMode}
        selected={selectedIds.has(item.id)}
        onToggleSelect={toggleSelect}
      />
    ),
    [
      handleDeleteNotification,
      handlePressById,
      isNotificationDismissing,
      selectMode,
      selectedIds,
      toggleSelect,
    ]
  );

  const emptyCopy = FILTER_EMPTY_COPY[activeFilter];

  if (authLoading) {
    return <ScreenSpinner />;
  }

  if (!userId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Sign in to view notifications.</Text>
      </View>
    );
  }

  if (isLoading && !notifications.length) {
    return <NotificationsListSkeleton />;
  }

  if (isError && !notifications.length) {
    const message = getErrorMessage(error);
    console.error("[notifications] failed to load notifications", error);
    return (
      <QueryErrorState
        title="Could not load notifications"
        message={message}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <View style={styles.container}>
      <FrennixLogo variant="icon" height={28} style={styles.brandMark} />
      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>Stay on top of your training network</Text>
        <Text style={styles.summaryBody}>
          Training matches, partner messages, follows, likes, comments, and event updates appear
          here in real time.
        </Text>
      </View>

      <NotificationFilterBar value={activeFilter} onChange={handleFilterChange} />

      {selectMode ? (
        <View style={styles.header}>
          <Pressable onPress={exitSelectMode} hitSlop={8}>
            <Text style={styles.markAll}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerText}>{selectedIds.size} selected</Text>
          <Pressable
            onPress={handleBulkDelete}
            disabled={!selectedIds.size || bulkDismissMutation.isPending}
            hitSlop={8}
          >
            <Text style={[styles.markAll, !selectedIds.size && styles.markAllDisabled]}>
              Delete
            </Text>
          </Pressable>
        </View>
      ) : unreadCount > 0 ? (
        <View style={styles.header}>
          <Text style={styles.headerText}>
            {unreadCount} unread notification{unreadCount === 1 ? "" : "s"}
          </Text>
          <View style={styles.headerActions}>
            {notifications.length > 0 ? (
              <Pressable onPress={() => setSelectMode(true)} hitSlop={8} style={styles.headerAction}>
                <Text style={styles.markAll}>Edit</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => markAllMutation.mutate()} hitSlop={8}>
              <Text style={styles.markAll}>Mark all read</Text>
            </Pressable>
          </View>
        </View>
      ) : notifications.length > 0 ? (
        <View style={styles.header}>
          <Text style={styles.headerText}>Notifications</Text>
          <View style={styles.headerActions}>
            <Pressable onPress={() => setSelectMode(true)} hitSlop={8} style={styles.headerAction}>
              <Text style={styles.markAll}>Edit</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                confirmBulkDismissNotifications(notifications.length, () =>
                  clearAllMutation.mutate()
                )
              }
              disabled={clearAllMutation.isPending}
              hitSlop={8}
            >
              <Text style={styles.markAll}>Clear all</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <SectionList
        style={styles.listView}
        sections={notificationSections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        windowSize={9}
        removeClippedSubviews={Platform.OS !== "web"}
        stickySectionHeadersEnabled={false}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.35}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{title}</Text>
          </View>
        )}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void onRefresh()}
            {...frennixRefreshControlProps}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon={emptyCopy.icon}
            title={emptyCopy.title}
            description={emptyCopy.description}
          />
        }
        ListFooterComponent={isFetchingNextPage ? <NotificationsPageFooterSkeleton /> : null}
        extraData={selectMode ? selectedIds : activeFilter}
        renderItem={renderItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  errorText: { ...typography.bodySmall, color: colors.textSecondary, textAlign: "center" },
  summary: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  summaryTitle: { ...typography.body, fontWeight: "700", color: colors.text },
  summaryBody: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  brandMark: { marginLeft: spacing.md, marginTop: spacing.sm, marginBottom: spacing.xs },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  headerText: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
  markAll: { ...typography.caption, color: colors.accent, fontWeight: "700" },
  markAllDisabled: { color: colors.textMuted },
  headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  headerAction: { marginRight: spacing.xs },
  selectRow: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingLeft: spacing.sm,
    backgroundColor: colors.background,
  },
  selectRowSelected: { backgroundColor: colors.surfaceElevated },
  selectBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginRight: spacing.xs,
  },
  selectBoxChecked: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  selectCheck: { color: colors.background, fontSize: 14, fontWeight: "700", lineHeight: 16 },
  selectRowContent: { flex: 1 },
  listView: { flex: 1 },
  list: { flexGrow: 1, paddingBottom: spacing.lg },
  sectionHeader: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    backgroundColor: colors.background,
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
});
