import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Notification } from "@frennix/types";
import { Avatar } from "./Avatar";
import { formatRelativeTime } from "./formatRelativeTime";
import { colors, spacing, typography } from "./theme";

interface NotificationRowProps {
  notification: Notification;
  text: string;
  onPress: () => void;
}

export const NotificationRow = memo(function NotificationRow({
  notification,
  text,
  onPress,
}: NotificationRowProps) {
  const isUnread = !notification.read_at;
  const actor = notification.actor;
  const createdAt = notification.created_at ?? new Date(0).toISOString();
  const label = text || "New activity on Frennix";

  return (
    <Pressable
      style={[styles.row, isUnread && styles.unreadRow]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: isUnread }}
      accessibilityLabel={`${label}. ${isUnread ? "Unread" : "Read"}. ${formatRelativeTime(createdAt)}`}
    >
      <View style={styles.avatarWrap}>
        <Avatar uri={actor?.avatar_url} name={actor?.display_name ?? "User"} size={48} />
        {isUnread ? <View style={styles.unreadDot} /> : null}
      </View>
      <View style={styles.content}>
        <Text style={[styles.text, isUnread && styles.unreadText]} numberOfLines={3}>
          {label}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.time}>{formatRelativeTime(createdAt)}</Text>
          <Text style={[styles.status, isUnread ? styles.statusUnread : styles.statusRead]}>
            {isUnread ? "Unread" : "Read"}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  unreadRow: {
    backgroundColor: colors.surfaceElevated,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  avatarWrap: {
    position: "relative",
  },
  unreadDot: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.background,
  },
  content: { flex: 1, gap: 6 },
  text: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
  unreadText: { color: colors.text, fontWeight: "600" },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  time: { ...typography.caption, color: colors.textMuted },
  status: { ...typography.caption, fontWeight: "700" },
  statusUnread: { color: colors.accent },
  statusRead: { color: colors.textMuted },
});
