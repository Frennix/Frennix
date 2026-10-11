import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import type { SuggestedAthlete } from "@frennix/types";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { isProfileOnline } from "./presence";
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
        nestedScrollEnabled
        style={WEB_HORIZONTAL_SCROLL_STYLE}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.profile.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isFollowing = followingSet.has(item.profile.id);
          const isFollowLoading = followLoadingId === item.profile.id;
          const isDismissLoading = dismissLoadingId === item.profile.id;
          const online = isProfileOnline(item.profile);

          return (
            <View style={styles.card}>
              <Pressable
                style={styles.profileTap}
                onPress={() => onProfilePress?.(item.profile.username)}
              >
                <Avatar
                  uri={item.profile.avatar_url}
                  name={item.profile.display_name}
                  size={44}
                  showOnline
                  isOnline={online}
                />
                <Text style={styles.name} numberOfLines={2} ellipsizeMode="tail">
                  {item.profile.display_name}
                </Text>
                <Text style={styles.username} numberOfLines={1} ellipsizeMode="tail">
                  @{item.profile.username}
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
                <Pressable
                  style={styles.dismiss}
                  onPress={() => onDismissPress?.(item)}
                  disabled={isDismissLoading}
                  accessibilityRole="button"
                  accessibilityLabel="Not Interested"
                >
                  {isDismissLoading ? (
                    <ActivityIndicator color={colors.textMuted} size="small" />
                  ) : (
                    <Text style={styles.dismissText} numberOfLines={1}>
                      Not Interested
                    </Text>
                  )}
                </Pressable>
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
    width: 148,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  profileTap: {
    alignItems: "center",
    gap: 2,
    width: "100%",
    minWidth: 0,
  },
  name: {
    ...typography.bodySmall,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    width: "100%",
    minHeight: 36,
    lineHeight: 18,
  },
  username: {
    ...typography.caption,
    color: colors.accent,
    textAlign: "center",
    width: "100%",
  },
  actions: {
    width: "100%",
    gap: 2,
  },
  actionButton: {
    width: "100%",
    minHeight: 36,
    paddingVertical: spacing.xs,
  },
  dismiss: {
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
  },
  dismissText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "600",
    textAlign: "center",
  },
});
