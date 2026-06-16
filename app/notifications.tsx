import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import {
  getNotificationActorName,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notificationText,
} from "@frennix/api";
import type { Notification } from "@frennix/types";
import { useAuth } from "@/providers/AuthProvider";
import { openNotificationTarget } from "@/lib/notification-navigation";
import { syncNotificationBadgeCount } from "@/lib/notifications";
import { EmptyState, NotificationRow, colors, spacing, typography } from "@frennix/ui";

export default function NotificationsScreen() {
  const { session, loading } = useAuth();
  const userId = session?.user.id ?? "";
  const notificationsReady = !loading && !!userId;
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => getNotifications(userId),
    enabled: notificationsReady,
  });

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  useEffect(() => {
    if (!notificationsReady) return;
    queryClient.setQueryData(["unread-notifications", userId], unreadCount);
  }, [notificationsReady, unreadCount, userId, queryClient]);

  const readMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
      queryClient.invalidateQueries({ queryKey: ["unread-notifications", userId] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
      queryClient.invalidateQueries({ queryKey: ["unread-notifications", userId] });
      void syncNotificationBadgeCount(0);
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
      {unreadCount > 0 ? (
        <View style={styles.header}>
          <Text style={styles.headerText}>{unreadCount} unread</Text>
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
              description="Likes, comments, matches, and messages will show up here."
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerText: { ...typography.caption, color: colors.textMuted },
  markAll: { ...typography.caption, color: colors.accent, fontWeight: "600" },
  list: { flexGrow: 1 },
});
