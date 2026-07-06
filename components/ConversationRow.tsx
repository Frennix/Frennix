import { Check, Pin } from "lucide-react-native";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Conversation } from "@frennix/types";
import { MessageActionsMenu } from "@/components/MessageActionsMenu";
import { Avatar, colors, isProfileOnline, spacing, typography } from "@frennix/ui";
import { DELETED_FOR_EVERYONE_CONTENT } from "@frennix/api";

function previewText(
  content: string | undefined,
  mediaUrl: string | null | undefined,
  postId: string | null | undefined,
  deletedForEveryone?: string | null
) {
  if (deletedForEveryone) return DELETED_FOR_EVERYONE_CONTENT;
  if (postId) return "↗ Shared a post";
  if (mediaUrl && (!content || content === "📷 Photo")) return "📷 Photo";
  return content ?? "Start the conversation";
}

type ConversationRowProps = {
  conversation: Conversation;
  onPress: () => void;
  onLongPress: () => void;
  onMenuPress?: () => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
};

export const ConversationRow = memo(function ConversationRow({
  conversation,
  onPress,
  onLongPress,
  onMenuPress,
  selectMode = false,
  selected = false,
  onToggleSelect,
}: ConversationRowProps) {
  const unreadCount = conversation.unread_count ?? 0;
  const showUnread = unreadCount > 0 || conversation.marked_unread;
  const showMenu = Boolean(onMenuPress) && !selectMode;

  const handlePress = () => {
    if (selectMode) {
      onToggleSelect?.();
      return;
    }
    onPress();
  };

  return (
    <Pressable
      style={[
        styles.row,
        conversation.is_pinned && styles.pinnedRow,
        selectMode && selected && styles.selectedRow,
      ]}
      onPress={handlePress}
      onLongPress={selectMode ? undefined : onLongPress}
      delayLongPress={350}
      accessibilityRole={selectMode ? "checkbox" : "button"}
      accessibilityState={selectMode ? { checked: selected } : undefined}
      accessibilityLabel={
        selectMode
          ? `${selected ? "Deselect" : "Select"} conversation with ${conversation.other_participant?.display_name ?? "Chat"}`
          : `Conversation with ${conversation.other_participant?.display_name ?? "Chat"}`
      }
    >
      {selectMode ? (
        <View
          style={[styles.selector, selected && styles.selectorSelected]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {selected ? <Check color={colors.black} size={14} strokeWidth={3} /> : null}
        </View>
      ) : null}
      <Avatar
        uri={conversation.other_participant?.avatar_url}
        name={conversation.other_participant?.display_name}
        size={52}
        showOnline={!selectMode}
        isOnline={isProfileOnline(conversation.other_participant)}
        deferImagePlaceholder
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
            conversation.last_message?.post_id,
            conversation.last_message?.deleted_for_everyone_at
          )}
        </Text>
      </View>
      <View style={styles.trailing}>
        {showMenu ? (
          <MessageActionsMenu
            onPress={onMenuPress!}
            accessibilityLabel="Conversation options"
            accessibilityHint="Opens pin, mark unread, and delete options"
          />
        ) : null}
        {!selectMode && showUnread ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 99 ? "99+" : unreadCount > 0 ? unreadCount : " "}
            </Text>
          </View>
        ) : null}
      </View>
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
    minHeight: 84,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  pinnedRow: {
    backgroundColor: colors.surfaceElevated,
    borderLeftWidth: 3,
    borderLeftColor: colors.textMuted,
  },
  selectedRow: {
    backgroundColor: colors.surface,
  },
  selector: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  selectorSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
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
  trailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
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
