import { FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, View, Animated, Easing, type ViewStyle } from "react-native";
import { useEffect, useRef } from "react";
import type { FeedStory } from "@frennix/types";
import { Avatar } from "./Avatar";
import { ScalePressable } from "./ScalePressable";
import { formatRelativeTime, formatStreakBadgeLabel } from "./formatRelativeTime";
import { applyShadow, colors, overlays, radius, spacing, typography } from "./theme";
import { feedLayout } from "./feed-layout";

interface FeedStoriesRowProps {
  stories: FeedStory[];
  onStoryPress?: (story: FeedStory) => void;
  onAddStoryPress?: () => void;
  onViewAllPress?: () => void;
}

const RING_SIZE = 76;
const AVATAR_SIZE = 64;
const ITEM_WIDTH = 96;

function storyLabel(item: FeedStory): string {
  const stories = item.active_stories ?? [];
  const latest = stories.at(-1);
  if (!latest) return item.is_self ? "Your Story" : "No story yet";
  const time = formatRelativeTime(latest.created_at);
  if (latest.workout_tag) return `${latest.workout_tag} · ${time}`;
  const slideCount = latest.slides.length;
  if (slideCount > 1) return `${slideCount} slides · ${time}`;
  return `Story · ${time}`;
}

function storyProgress(item: FeedStory): number {
  const slides = item.active_stories.at(-1)?.slides.length ?? 0;
  if (slides <= 1) return item.viewed ? 1 : 0.35;
  return Math.min(1, 0.25 + slides * 0.12);
}

function StoryGlow({ active }: { active: boolean }) {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);

  if (!active) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.glowRing,
        {
          opacity: pulse,
          transform: [
            {
              scale: pulse.interpolate({
                inputRange: [0.4, 1],
                outputRange: [1, 1.08],
              }),
            },
          ],
        },
      ]}
    />
  );
}

function StoryAvatar({
  story,
  onAddStoryPress,
}: {
  story: FeedStory;
  onAddStoryPress?: () => void;
}) {
  const activeStories = story.active_stories ?? [];
  const hasStoryContent = activeStories.length > 0 || story.is_self;
  const isUnviewed = hasStoryContent && !story.viewed && !story.is_self;
  const progress = storyProgress(story);

  const ringStyle = !hasStoryContent
    ? styles.avatarRingMuted
    : story.viewed
      ? styles.avatarRingViewed
      : styles.avatarRingUnviewed;

  return (
    <View style={styles.avatarShell}>
      <StoryGlow active={isUnviewed} />
      <View style={[styles.avatarRing, ringStyle]}>
        <View
          style={[
            styles.progressTrack,
            isUnviewed && { borderColor: colors.accent, opacity: 0.25 + progress * 0.75 },
          ]}
        />
        <View style={styles.avatarInner}>
          <Avatar uri={story.profile.avatar_url} name={story.profile.display_name} size={AVATAR_SIZE} />
        </View>
        {story.has_recent_workout && !story.is_self ? <View style={styles.onlineDot} /> : null}
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
          <Text style={styles.streakBadgeText}>🔥 {story.workout_streak}</Text>
        </View>
      ) : null}
    </View>
  );
}

function StoryItem({
  item,
  onStoryPress,
  onAddStoryPress,
}: {
  item: FeedStory;
  onStoryPress?: (story: FeedStory) => void;
  onAddStoryPress?: () => void;
}) {
  const isSelf = item.is_self;
  const label = storyLabel(item);
  const streakLabel = formatStreakBadgeLabel(item.workout_streak);
  const activeStories = item.active_stories ?? [];
  const hasActiveStory = activeStories.length > 0;

  return (
    <ScalePressable
      containerStyle={styles.item}
      pressedScale={0.94}
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
    </ScalePressable>
  );
}

export function FeedStoriesRow({
  stories,
  onStoryPress,
  onAddStoryPress,
  onViewAllPress,
}: FeedStoriesRowProps) {
  if (!stories.length) return null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Stories</Text>
        {onViewAllPress ? (
          <Pressable
            onPress={onViewAllPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="View all stories"
          >
            <Text style={styles.viewAll}>View All</Text>
          </Pressable>
        ) : null}
      </View>
      {Platform.OS === "web" ? (
        <View style={styles.webListShell}>
          <ScrollView
            horizontal
            nestedScrollEnabled
            style={WEB_HORIZONTAL_SCROLL_STYLE}
            contentContainerStyle={styles.listContent}
            showsHorizontalScrollIndicator={false}
          >
            {stories.map((item) => (
              <StoryItem
                key={item.user_id}
                item={item}
                onStoryPress={onStoryPress}
                onAddStoryPress={onAddStoryPress}
              />
            ))}
          </ScrollView>
        </View>
      ) : (
        <FlatList
          data={stories}
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.user_id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <StoryItem
              item={item}
              onStoryPress={onStoryPress}
              onAddStoryPress={onAddStoryPress}
            />
          )}
        />
      )}
    </View>
  );
}

const STORY_ROW_MIN_HEIGHT = RING_SIZE + 36;
const STORY_SECTION_HEIGHT = STORY_ROW_MIN_HEIGHT + 36;

const WEB_HORIZONTAL_SCROLL_STYLE: ViewStyle | undefined =
  Platform.OS === "web"
    ? ({
        touchAction: "pan-x pinch-zoom",
        height: STORY_ROW_MIN_HEIGHT,
        minHeight: STORY_ROW_MIN_HEIGHT,
        flexGrow: 0,
        flexShrink: 0,
      } as ViewStyle)
    : undefined;

const styles = StyleSheet.create({
  container: {
    paddingBottom: feedLayout.feedChrome.storiesPaddingBottom,
    gap: spacing.xs,
    flexShrink: 0,
    overflow: "visible",
    ...(Platform.OS === "web"
      ? ({ minHeight: STORY_SECTION_HEIGHT, flexBasis: "auto" } as ViewStyle)
      : null),
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
  },
  sectionTitle: {
    ...typography.section,
    fontSize: 17,
    color: colors.text,
    fontWeight: "800",
  },
  viewAll: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: "700",
  },
  webListShell: {
    height: STORY_ROW_MIN_HEIGHT,
    minHeight: STORY_ROW_MIN_HEIGHT,
    flexShrink: 0,
    overflow: "visible",
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: 0,
    gap: spacing.md,
  },
  item: {
    width: ITEM_WIDTH,
    alignItems: "center",
    gap: 6,
  },
  avatarShell: {
    width: RING_SIZE + 8,
    height: RING_SIZE + 8,
    alignItems: "center",
    justifyContent: "center",
  },
  glowRing: {
    position: "absolute",
    width: RING_SIZE + 10,
    height: RING_SIZE + 10,
    borderRadius: (RING_SIZE + 10) / 2,
    backgroundColor: overlays.accentTintStrong,
    ...applyShadow("accent"),
  },
  avatarRing: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    padding: 3,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  progressTrack: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RING_SIZE / 2,
    borderWidth: 3,
    borderColor: "transparent",
  },
  avatarRingUnviewed: {
    backgroundColor: colors.accent,
  },
  avatarRingViewed: {
    backgroundColor: colors.border,
  },
  avatarRingMuted: {
    backgroundColor: colors.borderSubtle,
  },
  avatarInner: {
    width: AVATAR_SIZE + 4,
    height: AVATAR_SIZE + 4,
    borderRadius: (AVATAR_SIZE + 4) / 2,
    overflow: "hidden",
    backgroundColor: colors.backgroundFeed,
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  onlineDot: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.backgroundFeed,
  },
  addBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.backgroundFeed,
    alignItems: "center",
    justifyContent: "center",
    ...applyShadow("accent"),
  },
  addBadgeText: {
    color: colors.black,
    fontSize: 16,
    lineHeight: 18,
    fontWeight: "800",
  },
  streakBadge: {
    position: "absolute",
    bottom: 0,
    right: -2,
    minWidth: 34,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  streakBadgeText: {
    ...typography.caption,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "800",
    color: colors.accent,
  },
  username: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: "700",
    textAlign: "center",
    width: "100%",
  },
  meta: {
    ...typography.caption,
    fontSize: 11,
    lineHeight: 13,
    color: colors.textMuted,
    textAlign: "center",
    width: "100%",
  },
  metaActive: {
    color: colors.accent,
    fontWeight: "700",
  },
});
