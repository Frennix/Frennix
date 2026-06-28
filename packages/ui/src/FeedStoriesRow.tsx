import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { FeedStory } from "@frennix/types";
import { Avatar } from "./Avatar";
import { formatLastWorkoutLabel, formatStreakBadgeLabel } from "./formatRelativeTime";
import { colors, spacing, typography } from "./theme";

interface FeedStoriesRowProps {
  stories: FeedStory[];
  onStoryPress?: (story: FeedStory) => void;
  onAddStoryPress?: () => void;
}

function StoryAvatar({ story }: { story: FeedStory }) {
  const hasStoryContent = Boolean(story.last_workout) || story.is_self;
  const ringStyle = !hasStoryContent
    ? styles.avatarRingMuted
    : story.viewed
      ? styles.avatarRingViewed
      : styles.avatarRingUnviewed;

  return (
    <View style={[styles.avatarRing, ringStyle]}>
      <View style={styles.avatarInner}>
        <Avatar uri={story.profile.avatar_url} name={story.profile.display_name} size={58} />
      </View>
      {story.workout_streak > 0 ? (
        <View style={styles.streakBadge}>
          <Text style={styles.streakBadgeText}>🔥{story.workout_streak}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function FeedStoriesRow({ stories, onStoryPress, onAddStoryPress }: FeedStoriesRowProps) {
  if (!stories.length) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Workout stories</Text>
      <FlatList
        data={stories}
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.user_id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isSelf = item.is_self;
          const lastWorkoutLabel = formatLastWorkoutLabel(item.last_workout);
          const streakLabel = formatStreakBadgeLabel(item.workout_streak);

          return (
            <Pressable
              style={styles.item}
              onPress={() => (isSelf && !item.last_workout ? onAddStoryPress?.() : onStoryPress?.(item))}
              accessibilityRole="button"
              accessibilityLabel={
                isSelf
                  ? `Your story, ${streakLabel}, ${lastWorkoutLabel}`
                  : `${item.profile.username} story, ${streakLabel}, ${lastWorkoutLabel}`
              }
            >
              <StoryAvatar story={item} />
              <Text style={styles.username} numberOfLines={1}>
                {isSelf ? "You" : item.profile.username}
              </Text>
              <Text style={[styles.meta, item.workout_streak > 0 && styles.metaActive]} numberOfLines={1}>
                {streakLabel}
              </Text>
              <Text style={styles.lastWorkout} numberOfLines={2}>
                {lastWorkoutLabel}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    paddingHorizontal: spacing.md,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  item: {
    width: 88,
    alignItems: "center",
    gap: 4,
  },
  avatarRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    padding: 3,
    position: "relative",
  },
  avatarRingUnviewed: {
    backgroundColor: colors.accent,
  },
  avatarRingViewed: {
    backgroundColor: colors.border,
  },
  avatarRingMuted: {
    backgroundColor: colors.border,
  },
  avatarInner: {
    flex: 1,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: colors.background,
    padding: 2,
  },
  streakBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    minWidth: 28,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  streakBadgeText: {
    ...typography.caption,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "800",
    color: colors.accent,
  },
  username: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "700",
    textAlign: "center",
    width: "100%",
  },
  meta: {
    ...typography.caption,
    fontSize: 10,
    lineHeight: 12,
    color: colors.textMuted,
    textAlign: "center",
    width: "100%",
  },
  metaActive: {
    color: colors.accent,
    fontWeight: "700",
  },
  lastWorkout: {
    ...typography.caption,
    fontSize: 10,
    lineHeight: 12,
    color: colors.textSecondary,
    textAlign: "center",
    width: "100%",
    minHeight: 24,
  },
});
