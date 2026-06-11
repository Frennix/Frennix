import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect } from "react";
import { FlatList, Pressable, StyleSheet, Text } from "react-native";
import { getNotifications, markNotificationRead, subscribeToNotifications } from "@frennix/api";
import type { Notification } from "@frennix/types";
import { useAuth } from "@/providers/AuthProvider";
import { EmptyState, colors, spacing, typography } from "@frennix/ui";

function notificationText(n: Notification) {
  switch (n.type) {
    case "follow":
      return "Someone started following you";
    case "message":
      return (n.payload.preview as string) ?? "New message";
    case "like":
      return "Someone liked your post";
    case "comment":
      return "Someone commented on your post";
    case "challenge_reminder":
      return "Challenge reminder";
    default:
      return "New activity on Frennix";
  }
}

function openNotification(n: Notification) {
  if (n.type === "message" && n.payload.conversation_id) {
    router.push(`/chat/${n.payload.conversation_id}`);
    return;
  }
  if (n.payload.post_id) {
    router.push(`/post/${n.payload.post_id}`);
    return;
  }
}

export default function NotificationsScreen() {
  const { session, loading } = useAuth();
  const userId = session?.user.id ?? "";
  const notificationsReady = !loading && !!userId;
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => getNotifications(userId),
    enabled: notificationsReady,
  });

  useEffect(() => {
    if (!notificationsReady) return;
    const channel = subscribeToNotifications(userId, () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    });
    return () => channel.unsubscribe();
  }, [notificationsReady, userId, queryClient]);

  const readMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", userId] }),
  });

  return (
    <FlatList
      style={styles.container}
      data={notifications}
      keyExtractor={(n) => n.id}
      contentContainerStyle={styles.list}
      ListEmptyComponent={
        <EmptyState
          title="All caught up"
          description="Notifications about follows, messages, and challenges appear here."
        />
      }
      renderItem={({ item }) => (
        <Pressable
          style={[styles.row, !item.read_at && styles.unread]}
          onPress={() => {
            if (!item.read_at) readMutation.mutate(item.id);
            openNotification(item);
          }}
        >
          <Text style={styles.text}>{notificationText(item)}</Text>
          <Text style={styles.time}>{new Date(item.created_at).toLocaleString()}</Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { flexGrow: 1 },
  row: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  unread: { backgroundColor: colors.surfaceElevated },
  text: { ...typography.body },
  time: { ...typography.caption, marginTop: 4 },
});
