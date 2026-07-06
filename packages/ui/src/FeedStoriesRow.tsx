import { FlatList, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import type { FeedStory } from "@frennix/types";
import { Avatar } from "./Avatar";
import { formatRelativeTime, formatStreakBadgeLabel } from "./formatRelativeTime";
import { colors, spacing, typography } from "./theme";
import { feedLayout } from "./feed-layout";

interface FeedStoriesRowProps {
  stories: FeedStory[];
  onStoryPress?: (story: FeedStory) => void;
  onAddStoryPress?: () => void;
}

function storyLabel(item: FeedStory): string {
  const latest = item.active_stories.at(-1);
  if (!latest) return item.is_self ? "Your Story" : "No story yet";
  const time = formatRelativeTime(latest.created_at);
  if (latest.workout_tag) return `${latest.workout_tag} · ${time}`;
  const slideCount = latest.slides.length;
  if (slideCount > 1) return `${slideCount} slides · ${time}`;
  return `Story · ${time}`;
}

function StoryAvatar({
  story,
  onAddStoryPress,
}: {
  story: FeedStory;
  onAddStoryPress?: () => void;
}) {
  const hasStoryContent = story.active_stories.length > 0 || story.is_self;
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
      {story.is_self ? (
        <Pressable
          style={styles.addBadge}
          onPress={onAddStoryPress}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Create story"
        >
          <Text style={styles.addBadgeText}>＋</Text>
        </Pressable>
      ) : story.workout_streak > 0 ? (
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
      <Text style={styles.sectionTitle}>Stories</Text>
      <FlatList
        data={stories}
        horizontal
        nestedScrollEnabled
        style={WEB_HORIZONTAL_SCROLL_STYLE}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.user_id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isSelf = item.is_self;
          const label = storyLabel(item);
          const streakLabel = formatStreakBadgeLabel(item.workout_streak);
          const hasActiveStory = item.active_stories.length > 0;

          return (
            <Pressable
              style={styles.item}
              onPress={() => {
                if (isSelf && !hasActiveStory) {
                  onAddStoryPress?.();
                  return;
                }
                if (hasActiveStory) onStoryPress?.(item);
              }}
              accessibilityRole="button"
              accessibilityLabel={
                isSelf
                  ? `Your story, ${streakLabel}, ${label}`
                  : `${item.profile.username} story, ${label}`
              }
            >
              <StoryAvatar story={item} onAddStoryPress={onAddStoryPress} />
              <Text style={styles.username} numberOfLines={1}>
                {isSelf ? "Your Story" : item.profile.username}
              </Text>
              <Text style={[styles.meta, item.workout_streak > 0 && styles.metaActive]} numberOfLines={1}>
                {streakLabel}
              </Text>
              <Text style={styles.lastWorkout} numberOfLines={2}>
                {label}
              </Text>
            </Pressable>
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: feedLayout.feedChrome.storiesPaddingBottom,
    gap: spacing.xxs,
  },
  sectionTitle: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    paddingHorizontal: spacing.md,
    marginBottom: -2,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
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
  addBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  addBadgeText: {
    color: colors.black,
    fontSize: 16,
    lineHeight: 18,
    fontWeight: "800",
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
