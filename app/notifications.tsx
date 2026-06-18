import { memo, useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  buildNotificationRowText,
  getErrorMessage,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@frennix/api";
import type { Notification } from "@frennix/types";
import { useAuth } from "@/providers/AuthProvider";
import { openNotificationTarget } from "@/lib/notification-navigation";
import { syncNotificationBadgeCount } from "@/lib/notifications";
import { useTabBadges } from "@/providers/TabBadgeProvider";
import { showAlert } from "@/lib/alerts";
import { EmptyState, NotificationRow, colors, spacing, typography } from "@frennix/ui";

const SafeNotificationRow = memo(function SafeNotificationRow({
  notification,
  text,
  onPress,
}: {
  notification: Notification;
  text: string;
  onPress: (id: string) => void;
}) {
  return (
    <NotificationRow
      notification={notification}
      text={text}
      onPress={() => onPress(notification.id)}
    />
  );
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

  const notificationsById = useMemo(() => {
    const map = new Map<string, Notification>();
    for (const item of notifications) {
      map.set(item.id, item);
    }
    return map;
  }, [notifications]);

  const rowTextById = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of notifications) {
      map.set(item.id, buildNotificationRowText(item));
    }
    return map;
  }, [notifications]);

  const handlePressById = useCallback(
    (notificationId: string) => {
      const notification = notificationsById.get(notificationId);
      if (!notification) return;

      if (!notification.read_at) {
        readMutation.mutate(notification.id);
      }

      const result = openNotificationTarget(notification);
      if (!result.ok) {
        showAlert("Unavailable", result.message);
      }
    },
    [notificationsById, readMutation]
  );

  const renderItem = useCallback(
    ({ item }: { item: Notification }) => (
      <SafeNotificationRow
        notification={item}
        text={rowTextById.get(item.id) ?? "New activity on Frennix"}
        onPress={handlePressById}
      />
    ),
    [handlePressById, rowTextById]
  );

  if (authLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (!userId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Sign in to view notifications.</Text>
      </View>
    );
  }

  if (isLoading && !notifications.length) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (isError) {
    const message = getErrorMessage(error);
    console.error("[notifications] failed to load notifications", error);
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Could not load notifications</Text>
        <Text style={styles.errorText}>{message}</Text>
        <Pressable onPress={() => refetch()} style={styles.retryButton}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>Stay on top of your fitness community</Text>
        <Text style={styles.summaryBody}>
          Follows, likes, reactions, comments, replies, and messages appear here in real time.
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
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          <EmptyState
            title="All caught up"
            description="When someone follows you, likes or reacts to a post, comments, replies, or sends a message, you'll see it here instantly."
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
  loadingText: { ...typography.bodySmall, color: colors.textMuted, marginTop: spacing.sm },
  errorTitle: { ...typography.heading, textAlign: "center" },
  errorText: { ...typography.bodySmall, color: colors.textSecondary, textAlign: "center" },
  retryButton: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryText: { ...typography.bodySmall, color: colors.accent, fontWeight: "700" },
  summary: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  summaryTitle: { ...typography.body, fontWeight: "700", color: colors.text },
  summaryBody: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
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
