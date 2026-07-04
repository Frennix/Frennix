import { Dumbbell } from "lucide-react-native";
import { memo } from "react";
import { FlatList, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import type { Conversation, FeedStory } from "@frennix/types";
import { FavoritePartnerQuickActions } from "@/components/FavoritePartnerQuickActions";
import { Avatar, colors, formatStreakBadgeLabel, isProfileOnline, spacing, typography } from "@frennix/ui";

export type FavoritePartnerAction = {
  conversation: Conversation;
  action: "message" | "profile" | "story" | "invite_workout" | "invite_event";
};

type FavoriteTrainingPartnersSectionProps = {
  favorites: Conversation[];
  partnerStoriesByUserId: Map<string, FeedStory>;
  inviteLoadingUserId: string | null;
  onAction: (payload: FavoritePartnerAction) => void;
  onLongPress: (conversation: Conversation) => void;
};

const WEB_HORIZONTAL_SCROLL_STYLE: ViewStyle | undefined =
  Platform.OS === "web"
    ? ({
        touchAction: "pan-x pinch-zoom",
      } as ViewStyle)
    : undefined;

function FavoritePartnerCard({
  conversation,
  partnerStory,
  inviteLoading,
  onAction,
  onLongPress,
}: {
  conversation: Conversation;
  partnerStory?: FeedStory;
  inviteLoading: boolean;
  onAction: (payload: FavoritePartnerAction) => void;
  onLongPress: () => void;
}) {
  const partner = conversation.other_participant;
  const partnerId = partner?.id;
  const unreadCount = conversation.unread_count ?? 0;
  const showUnread = unreadCount > 0 || conversation.marked_unread;
  const isOnline = isProfileOnline(partner);
  const hasActiveStory = (partnerStory?.active_stories.length ?? 0) > 0;
  const streak = partnerStory?.workout_streak ?? 0;

  return (
    <View style={styles.card}>
      <Pressable
        onLongPress={onLongPress}
        delayLongPress={350}
        style={styles.identityTap}
        accessibilityRole="button"
        accessibilityLabel={`${partner?.display_name ?? "Partner"} favorite training partner`}
      >
        <View
          style={[styles.avatarRing, hasActiveStory && styles.avatarRingStory]}
          accessibilityLabel={hasActiveStory ? "Active workout story" : undefined}
        >
          <View style={styles.avatarInner}>
            <Avatar
              uri={partner?.avatar_url}
              name={partner?.display_name}
              size={52}
              showOnline
              isOnline={isOnline}
            />
          </View>
        </View>

        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {partner?.display_name ?? "Partner"}
          </Text>
          <View style={styles.dumbbellBadge} accessibilityLabel="Favorite training partner">
            <Dumbbell color={colors.accent} size={11} strokeWidth={2.5} />
          </View>
        </View>

        {streak > 0 ? (
          <Text style={styles.streak} numberOfLines={1}>
            🔥 {formatStreakBadgeLabel(streak)}
          </Text>
        ) : (
          <Text style={styles.streakMuted} numberOfLines={1}>
            Ready to train
          </Text>
        )}
      </Pressable>

      <FavoritePartnerQuickActions
        hasStory={hasActiveStory}
        inviteLoading={inviteLoading}
        onMessage={() => onAction({ conversation, action: "message" })}
        onProfile={() => onAction({ conversation, action: "profile" })}
        onStory={() => onAction({ conversation, action: "story" })}
        onInviteWorkout={() => onAction({ conversation, action: "invite_workout" })}
        onInviteEvent={() => onAction({ conversation, action: "invite_event" })}
      />

      {showUnread ? (
        <View style={styles.unreadDot}>
          <Text style={styles.unreadDotText}>
            {unreadCount > 0 ? (unreadCount > 9 ? "9+" : unreadCount) : "•"}
          </Text>
        </View>
      ) : null}
      {conversation.is_muted ? (
        <Text style={styles.mutedIcon} accessibilityLabel="Muted">
          🔕
        </Text>
      ) : null}

      <Text style={styles.longPressHint}>Hold avatar for more options</Text>
    </View>
  );
}

export const FavoriteTrainingPartnersSection = memo(function FavoriteTrainingPartnersSection({
  favorites,
  partnerStoriesByUserId,
  inviteLoadingUserId,
  onAction,
  onLongPress,
}: FavoriteTrainingPartnersSectionProps) {
  if (!favorites.length) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Dumbbell color={colors.accent} size={16} strokeWidth={2.5} />
        <Text style={styles.title}>Favorite Training Partners</Text>
      </View>
      <FlatList
        data={favorites}
        horizontal
        nestedScrollEnabled
        style={WEB_HORIZONTAL_SCROLL_STYLE}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const partnerId = item.other_participant?.id;
          return (
            <FavoritePartnerCard
              conversation={item}
              partnerStory={partnerId ? partnerStoriesByUserId.get(partnerId) : undefined}
              inviteLoading={Boolean(partnerId && inviteLoadingUserId === partnerId)}
              onAction={onAction}
              onLongPress={() => onLongPress(item)}
            />
          );
        }}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  card: {
    width: 168,
    alignItems: "center",
    gap: 2,
    position: "relative",
    paddingBottom: spacing.xs,
  },
  identityTap: {
    alignItems: "center",
    width: "100%",
  },
  avatarRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    padding: 2,
    backgroundColor: colors.border,
  },
  avatarRingStory: {
    backgroundColor: colors.accent,
  },
  avatarInner: {
    flex: 1,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: colors.background,
    padding: 2,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: "100%",
    marginTop: spacing.xs,
  },
  name: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "700",
    flexShrink: 1,
    textAlign: "center",
  },
  dumbbellBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentTint,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  streak: {
    ...typography.caption,
    fontSize: 10,
    lineHeight: 12,
    color: colors.accent,
    fontWeight: "700",
    textAlign: "center",
    maxWidth: "100%",
  },
  streakMuted: {
    ...typography.caption,
    fontSize: 10,
    lineHeight: 12,
    color: colors.textMuted,
    textAlign: "center",
  },
  unreadDot: {
    position: "absolute",
    top: 0,
    right: 12,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  unreadDotText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "800",
    color: colors.black,
  },
  mutedIcon: {
    position: "absolute",
    top: 42,
    left: 8,
    fontSize: 12,
    lineHeight: 14,
  },
  longPressHint: {
    ...typography.caption,
    fontSize: 9,
    lineHeight: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
});
