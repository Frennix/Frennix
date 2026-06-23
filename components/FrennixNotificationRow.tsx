import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Notification } from "@frennix/types";
import { buildNotificationDisplay } from "@frennix/api";
import { Avatar, formatRelativeTime, colors, spacing, typography } from "@frennix/ui";

type FrennixNotificationRowProps = {
  notification: Notification;
  onPress: () => void;
};

export const FrennixNotificationRow = memo(function FrennixNotificationRow({
  notification,
  onPress,
}: FrennixNotificationRowProps) {
  const isUnread = !notification.read_at;
  const actor = notification.actor;
  const createdAt = notification.created_at ?? new Date(0).toISOString();
  const display = buildNotificationDisplay(
    notification,
    actor?.display_name ?? "Someone"
  );

  return (
    <Pressable
      style={[styles.row, isUnread && styles.unreadRow]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: isUnread }}
      accessibilityLabel={`${display.headline}. ${display.detail}. ${isUnread ? "Unread" : "Read"}. ${formatRelativeTime(createdAt)}`}
    >
      <View style={styles.avatarWrap}>
        <Avatar uri={actor?.avatar_url} name={actor?.display_name ?? "Athlete"} size={48} />
        {isUnread ? <View style={styles.unreadDot} /> : null}
      </View>
      <View style={styles.content}>
        <Text style={[styles.headline, isUnread && styles.unreadHeadline]} numberOfLines={1}>
          {display.headline}
        </Text>
        <Text style={[styles.detail, isUnread && styles.unreadDetail]} numberOfLines={2}>
          {display.detail}
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
  content: { flex: 1, gap: 4 },
  headline: { ...typography.bodySmall, fontWeight: "700", color: colors.textSecondary },
  unreadHeadline: { color: colors.text },
  detail: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
  unreadDetail: { color: colors.text, fontWeight: "600" },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginTop: 2,
  },
  time: { ...typography.caption, color: colors.textMuted },
  status: { ...typography.caption, fontWeight: "700" },
  statusUnread: { color: colors.accent },
  statusRead: { color: colors.textMuted },
});
