import { Pin } from "lucide-react-native";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Conversation } from "@frennix/types";
import { Avatar, colors, isProfileOnline, spacing, typography } from "@frennix/ui";

function previewText(
  content: string | undefined,
  mediaUrl: string | null | undefined,
  postId: string | null | undefined
) {
  if (postId) return "↗ Shared a post";
  if (mediaUrl && (!content || content === "📷 Photo")) return "📷 Photo";
  return content ?? "Start the conversation";
}

type ConversationRowProps = {
  conversation: Conversation;
  onPress: () => void;
  onLongPress: () => void;
};

export const ConversationRow = memo(function ConversationRow({
  conversation,
  onPress,
  onLongPress,
}: ConversationRowProps) {
  const unreadCount = conversation.unread_count ?? 0;
  const showUnread = unreadCount > 0 || conversation.marked_unread;

  return (
    <Pressable
      style={[styles.row, conversation.is_pinned && styles.pinnedRow]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={`Conversation with ${conversation.other_participant?.display_name ?? "Chat"}`}
    >
      <Avatar
        uri={conversation.other_participant?.avatar_url}
        name={conversation.other_participant?.display_name}
        size={52}
        showOnline
        isOnline={isProfileOnline(conversation.other_participant)}
      />
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {conversation.other_participant?.display_name ?? "Chat"}
          </Text>
          {conversation.is_pinned ? (
            <View style={styles.pinBadge} accessibilityLabel="Pinned conversation">
              <Pin color={colors.textMuted} size={13} strokeWidth={2.5} />
            </View>
          ) : null}
          {conversation.is_muted ? (
            <Text style={styles.mutedIcon} accessibilityLabel="Muted">
              🔕
            </Text>
          ) : null}
        </View>
        <Text
          style={[styles.preview, showUnread && styles.previewUnread]}
          numberOfLines={1}
        >
          {previewText(
            conversation.last_message?.content,
            conversation.last_message?.media_url,
            conversation.last_message?.post_id
          )}
        </Text>
      </View>
      {showUnread ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 99 ? "99+" : unreadCount > 0 ? unreadCount : " "}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  pinnedRow: {
    backgroundColor: colors.surfaceElevated,
    borderLeftWidth: 3,
    borderLeftColor: colors.textMuted,
  },
  info: { flex: 1, minWidth: 0 },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  name: { ...typography.body, fontWeight: "600", flexShrink: 1 },
  pinBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mutedIcon: { fontSize: 14, lineHeight: 16 },
  preview: { ...typography.caption, marginTop: 4 },
  previewUnread: { color: colors.text, fontWeight: "600" },
  badge: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: colors.black, fontSize: 12, fontWeight: "700" },
});
