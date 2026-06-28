import { memo, useCallback } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getErrorMessage, getNotifications, markAllNotificationsRead, markNotificationRead } from "@frennix/api";
import type { Notification } from "@frennix/types";
import { useAuth } from "@/providers/AuthProvider";
import { openNotificationTargetAsync } from "@/lib/notification-navigation";
import { useGuardedRefresh } from "@/lib/useGuardedRefresh";
import { useTabBadges } from "@/providers/TabBadgeProvider";
import { showAlert } from "@/lib/alerts";
import { syncNotificationBadgeCount } from "@/lib/notifications";
import { NotificationsListSkeleton } from "@/components/NotificationsListSkeleton";
import { EmptyState, QueryErrorState, ScreenSpinner, colors, spacing, typography } from "@frennix/ui";
import { FrennixLogo } from "@/components/FrennixLogo";
import { FrennixNotificationRow } from "@/components/FrennixNotificationRow";

const SafeNotificationRow = memo(function SafeNotificationRow({
  notification,
  onPress,
}: {
  notification: Notification;
  onPress: (id: string) => void;
}) {
  return <FrennixNotificationRow notification={notification} onPress={() => onPress(notification.id)} />;
});

export default function NotificationsScreen() {
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user.id ?? "";
  const notificationsReady = !authLoading && !!userId;
  const queryClient = useQueryClient();
  const { unreadNotifications: unreadCount } = useTabBadges();

  const {
    data: notifications = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => getNotifications(userId),
    enabled: notificationsReady,
    staleTime: 30_000,
  });

  const onRefresh = useGuardedRefresh(
    useCallback(() => refetch(), [refetch]),
    { errorTitle: "Could not refresh notifications" }
  );

  const readMutation = useMutation({
    mutationFn: markNotificationRead,
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: ["notifications", userId] });
      const previous = queryClient.getQueryData<Notification[]>(["notifications", userId]);
      queryClient.setQueryData<Notification[]>(["notifications", userId], (current) =>
        (current ?? []).map((item) =>
          item.id === notificationId ? { ...item, read_at: new Date().toISOString() } : item
        )
      );
      queryClient.setQueryData<number>(["unread-notifications", userId], (current) =>
        Math.max(0, (current ?? 0) - 1)
      );
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["notifications", userId], context.previous);
      }
      queryClient.invalidateQueries({ queryKey: ["unread-notifications", userId] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(userId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["notifications", userId] });
      const previous = queryClient.getQueryData<Notification[]>(["notifications", userId]);
      const readAt = new Date().toISOString();
      queryClient.setQueryData<Notification[]>(["notifications", userId], (current) =>
        (current ?? []).map((item) => ({ ...item, read_at: item.read_at ?? readAt }))
      );
      queryClient.setQueryData(["unread-notifications", userId], 0);
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["notifications", userId], context.previous);
      }
      queryClient.invalidateQueries({ queryKey: ["unread-notifications", userId] });
    },
    onSuccess: () => {
      void syncNotificationBadgeCount(0);
    },
  });

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

  const renderItem = useCallback(
    ({ item }: { item: Notification }) => (
      <SafeNotificationRow notification={item} onPress={handlePressById} />
    ),
    [handlePressById]
  );

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

  if (isError) {
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

      {unreadCount > 0 ? (
        <View style={styles.header}>
          <Text style={styles.headerText}>
            {unreadCount} unread notification{unreadCount === 1 ? "" : "s"}
          </Text>
          <Pressable onPress={() => markAllMutation.mutate()} hitSlop={8}>
            <Text style={styles.markAll}>Mark all read</Text>
          </Pressable>
        </View>
      ) : null}

      <FlatList
        style={styles.listView}
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        windowSize={9}
        removeClippedSubviews={Platform.OS !== "web"}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void onRefresh()}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title="All caught up"
            description="When you connect with a training partner, receive a message, or get activity on your posts, you'll see it here instantly."
          />
        }
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
  listView: { flex: 1 },
  list: { flexGrow: 1 },
});
