import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import {
  getNotificationActorName,
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  notificationText,
} from "@frennix/api";
import type { Notification } from "@frennix/types";
import { useAuth } from "@/providers/AuthProvider";
import { openNotificationTarget } from "@/lib/notification-navigation";
import { useNotificationSubscription } from "@/lib/useNotificationSubscription";
import { syncNotificationBadgeCount } from "@/lib/notifications";
import { EmptyState, NotificationRow, colors, spacing, typography } from "@frennix/ui";

export default function NotificationsScreen() {
  const { session, loading } = useAuth();
  const userId = session?.user.id ?? "";
  const notificationsReady = !loading && !!userId;
  const queryClient = useQueryClient();

  useNotificationSubscription(userId);

  const { data: notifications = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => getNotifications(userId),
    enabled: notificationsReady,
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["unread-notifications", userId],
    queryFn: () => getUnreadNotificationCount(userId),
    enabled: notificationsReady,
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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
      queryClient.invalidateQueries({ queryKey: ["unread-notifications", userId] });
    },
  });

  function handlePress(notification: Notification) {
    if (!notification.read_at) {
      readMutation.mutate(notification.id);
    }
    openNotificationTarget(notification);
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
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              title="All caught up"
              description="When someone follows you, likes or reacts to a post, comments, replies, or sends a message, you'll see it here instantly."
            />
          ) : null
        }
        renderItem={({ item }) => (
          <NotificationRow
            notification={item}
            text={notificationText(item, getNotificationActorName(item.actor))}
            onPress={() => handlePress(item)}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
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
  list: { flexGrow: 1 },
});
