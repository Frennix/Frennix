import { FlatList, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import type { SuggestedAthlete } from "@frennix/types";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { formatPresenceStatus, isProfileOnline } from "./presence";
import { colors, spacing, typography } from "./theme";

interface PeopleYouMayKnowCarouselProps {
  suggestions: SuggestedAthlete[];
  followingIds?: string[];
  onProfilePress?: (username: string) => void;
  onFollowPress?: (profileId: string, isFollowing: boolean) => void;
  onDismissPress?: (athlete: SuggestedAthlete) => void;
  followLoadingId?: string | null;
  dismissLoadingId?: string | null;
}

export function PeopleYouMayKnowCarousel({
  suggestions,
  followingIds = [],
  onProfilePress,
  onFollowPress,
  onDismissPress,
  followLoadingId = null,
  dismissLoadingId = null,
}: PeopleYouMayKnowCarouselProps) {
  if (!suggestions.length) return null;

  const followingSet = new Set(followingIds);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>People you may know</Text>
      <FlatList
        data={suggestions}
        horizontal
        style={WEB_HORIZONTAL_SCROLL_STYLE}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.profile.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isFollowing = followingSet.has(item.profile.id);
          const isFollowLoading = followLoadingId === item.profile.id;
          const isDismissLoading = dismissLoadingId === item.profile.id;
          const online = isProfileOnline(item.profile);
          const presenceLabel = formatPresenceStatus(item.profile);

          return (
            <View style={styles.card}>
              <Pressable
                style={styles.profileTap}
                onPress={() => onProfilePress?.(item.profile.username)}
              >
                <Avatar
                  uri={item.profile.avatar_url}
                  name={item.profile.display_name}
                  size={64}
                  showOnline
                  isOnline={online}
                />
                <Text style={styles.name} numberOfLines={1}>
                  {item.profile.display_name}
                </Text>
                <Text style={styles.username} numberOfLines={1}>
                  @{item.profile.username}
                </Text>
                {presenceLabel ? (
                  <Text
                    style={[styles.presence, online && styles.presenceOnline]}
                    numberOfLines={1}
                  >
                    {presenceLabel}
                  </Text>
                ) : null}
                <Text style={styles.reason} numberOfLines={2}>
                  {item.reason}
                </Text>
              </Pressable>
              <View style={styles.actions}>
                <Button
                  title={isFollowing ? "Following" : "Follow"}
                  variant={isFollowing ? "secondary" : "primary"}
                  onPress={() => onFollowPress?.(item.profile.id, isFollowing)}
                  loading={isFollowLoading}
                  style={styles.actionButton}
                />
                <Button
                  title="Not Interested"
                  variant="secondary"
                  onPress={() => onDismissPress?.(item)}
                  loading={isDismissLoading}
                  style={styles.actionButton}
                  accessibilityLabel="Remove suggestion"
                />
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const WEB_HORIZONTAL_SCROLL_STYLE: ViewStyle | undefined =
  Platform.OS === "web"
    ? ({
        touchAction: "pan-x pinch-zoom",
      } as ViewStyle)
    : undefined;

const styles = StyleSheet.create({
  container: {
    gap: spacing.xxs,
    paddingBottom: spacing.xxs,
  },
  sectionTitle: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  listContent: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  card: {
    width: 176,
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  profileTap: {
    alignItems: "center",
    gap: 4,
  },
  name: {
    ...typography.bodySmall,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    width: "100%",
  },
  username: {
    ...typography.caption,
    color: colors.accent,
    textAlign: "center",
    width: "100%",
  },
  presence: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
    width: "100%",
  },
  presenceOnline: { color: colors.accent, fontWeight: "600" },
  reason: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
    minHeight: 28,
    lineHeight: 14,
  },
  actions: {
    width: "100%",
    gap: spacing.xs,
  },
  actionButton: {
    width: "100%",
    minHeight: 36,
    paddingVertical: spacing.sm,
  },
});
