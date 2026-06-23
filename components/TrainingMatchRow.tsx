import { memo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { TrainingMatchListItem } from "@/lib/training-match-rows";
import { formatTrainingMatchDate } from "@/lib/training-match-rows";
import {
  Avatar,
  Button,
  colors,
  formatPresenceStatus,
  isProfileOnline,
  spacing,
  typography,
} from "@frennix/ui";

type TrainingMatchRowProps = {
  item: TrainingMatchListItem;
  onOpenChat: (partnerId: string) => void;
  onRemove: (matchId: string, partnerName: string) => void;
  openingChat?: boolean;
  removing?: boolean;
};

function messagePreview(item: TrainingMatchListItem) {
  const content = item.conversation?.last_message?.content?.trim();
  if (content) return content;
  return "Start planning your next workout together";
}

export const TrainingMatchRow = memo(function TrainingMatchRow({
  item,
  onOpenChat,
  onRemove,
  openingChat,
  removing,
}: TrainingMatchRowProps) {
  const partner = item.other_user;
  if (!partner) return null;

  const online = isProfileOnline(partner);
  const presenceLabel = formatPresenceStatus(partner);
  const unreadCount = item.conversation?.unread_count ?? 0;

  return (
    <View style={styles.row}>
      <Avatar
        uri={partner.avatar_url}
        name={partner.display_name}
        size={56}
        showOnline
        isOnline={online}
      />

      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {partner.display_name}
          </Text>
          {unreadCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </Text>
            </View>
          ) : null}
        </View>

        {partner.username ? (
          <Text style={styles.username} numberOfLines={1}>
            @{partner.username}
          </Text>
        ) : null}

        {presenceLabel ? (
          <Text style={[styles.presence, online && styles.presenceOnline]} numberOfLines={1}>
            {presenceLabel}
          </Text>
        ) : (
          <Text style={styles.presenceMuted}>Activity unavailable</Text>
        )}

        <Text style={styles.matchMeta}>
          Training match · {formatTrainingMatchDate(item.created_at)}
        </Text>

        <Text
          style={[styles.preview, unreadCount > 0 && styles.previewUnread]}
          numberOfLines={1}
        >
          {messagePreview(item)}
        </Text>
      </View>

      <View style={styles.actions}>
        <Button
          title="Open chat"
          onPress={() => onOpenChat(partner.id)}
          loading={openingChat}
          style={styles.chatButton}
        />
        <Pressable
          onPress={() => onRemove(item.id, partner.display_name)}
          disabled={openingChat || removing}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Remove training match with ${partner.display_name}`}
        >
          <Text style={[styles.removeText, (openingChat || removing) && styles.removeTextDisabled]}>
            {removing ? "Removing…" : "Remove"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
});

export function TrainingMatchRowSkeleton() {
  return (
    <View style={styles.row}>
      <View style={styles.skeletonAvatar} />
      <View style={styles.info}>
        <ActivityIndicator color={colors.accent} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  info: { flex: 1, gap: 2, minWidth: 0 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  name: { ...typography.body, fontWeight: "600", color: colors.text, flexShrink: 1 },
  username: { ...typography.caption, color: colors.textMuted },
  presence: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  presenceOnline: { color: colors.accent, fontWeight: "600" },
  presenceMuted: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  matchMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  preview: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  previewUnread: { color: colors.text, fontWeight: "600" },
  badge: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: colors.black, fontSize: 11, fontWeight: "700" },
  actions: { alignItems: "center", gap: spacing.sm, alignSelf: "center" },
  chatButton: { minWidth: 96, minHeight: 40 },
  removeText: { ...typography.caption, color: colors.danger, fontWeight: "600" },
  removeTextDisabled: { opacity: 0.5 },
  skeletonAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceElevated,
  },
});
