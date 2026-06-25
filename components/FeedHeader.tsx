import { Pressable, StyleSheet, Text, View } from "react-native";
import type { FeedStory, SuggestedAthlete } from "@frennix/types";
import { FrennixLogo } from "@/components/FrennixLogo";
import { FeedStoriesRow, PeopleYouMayKnowCarousel, colors, spacing, typography } from "@frennix/ui";
import { openCreatePost, pushScreen, switchTab } from "@/lib/press-utils";

interface FeedHeaderProps {
  stories?: FeedStory[];
  suggestions?: SuggestedAthlete[];
  followingIds?: string[];
  followLoadingId?: string | null;
  onStoryPress?: (story: FeedStory) => void;
  onFollowPress?: (profileId: string, isFollowing: boolean) => void;
}

export function FeedHeader({
  stories = [],
  suggestions = [],
  followingIds = [],
  followLoadingId = null,
  onStoryPress,
  onFollowPress,
}: FeedHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.titleBlock}>
          <FrennixLogo variant="full" height={34} />
          <Text style={styles.subtitle}>Workouts, progress, and wins from your network</Text>
        </View>
        <Pressable
          style={styles.createButton}
          onPress={openCreatePost}
          accessibilityRole="button"
          accessibilityLabel="Create post"
        >
          <Text style={styles.createIcon}>＋</Text>
        </Pressable>
      </View>

      <PeopleYouMayKnowCarousel
        suggestions={suggestions}
        followingIds={followingIds}
        onProfilePress={(username) => pushScreen(`/user/${username}`)}
        onFollowPress={onFollowPress}
        followLoadingId={followLoadingId}
      />

      <FeedStoriesRow
        stories={stories}
        onStoryPress={onStoryPress}
        onAddStoryPress={openCreatePost}
      />

      <View style={styles.quickActions}>
        <Pressable style={styles.chip} onPress={openCreatePost}>
          <Text style={styles.chipText}>Share workout</Text>
        </Pressable>
        <Pressable style={styles.chip} onPress={() => switchTab("/(tabs)/discover")}>
          <Text style={styles.chipText}>Find athletes</Text>
        </Pressable>
        <Pressable style={styles.chip} onPress={() => switchTab("/(tabs)/events")}>
          <Text style={styles.chipText}>Events</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  titleBlock: { flex: 1, gap: 4 },
  subtitle: { ...typography.caption, color: colors.textMuted },
  createButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  createIcon: {
    color: colors.black,
    fontSize: 24,
    lineHeight: 26,
    fontWeight: "700",
  },
  quickActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { ...typography.bodySmall, color: colors.text, fontWeight: "600" },
});
