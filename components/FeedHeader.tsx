import { memo, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { HOME_FEED_TABS, type FeedStory, type HomeFeedTab, type SuggestedAthlete } from "@frennix/types";
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary";
import {
  FeedHeroBanner,
  FeedQuickActionCards,
  FeedCategoryTabs,
  FeedStoriesRow,
  PeopleYouMayKnowCarousel,
  colors,
  feedLayout,
  spacing,
  typography,
} from "@frennix/ui";
import { openCreatePost, openCreateStory, pushScreen, switchTab } from "@/lib/press-utils";

interface FeedHeaderProps {
  stories?: FeedStory[];
  suggestions?: SuggestedAthlete[];
  followingIds?: string[];
  followLoadingId?: string | null;
  onStoryPress?: (story: FeedStory) => void;
  onFollowPress?: (profileId: string, isFollowing: boolean) => void;
  onDismissPress?: (athlete: SuggestedAthlete) => void;
  dismissLoadingId?: string | null;
  showHero?: boolean;
  showSuggestions?: boolean;
  showStories?: boolean;
  showQuickActions?: boolean;
  feedTab?: HomeFeedTab;
  onFeedTabChange?: (tab: HomeFeedTab) => void;
  showFeedTabs?: boolean;
}

export const FeedHeader = memo(function FeedHeader({
  stories = [],
  suggestions = [],
  followingIds = [],
  followLoadingId = null,
  onStoryPress,
  onFollowPress,
  onDismissPress,
  dismissLoadingId = null,
  showHero = true,
  showSuggestions = true,
  showStories = true,
  showQuickActions = true,
  feedTab = "all",
  onFeedTabChange,
  showFeedTabs = true,
}: FeedHeaderProps) {
  const quickActions = useMemo(
    () => [
      { key: "share", emoji: "🏋️", title: "Share", onPress: () => openCreatePost() },
      { key: "stories", emoji: "🔍", title: "Explore", onPress: () => pushScreen("/stories/explore") },
      { key: "athletes", emoji: "🎯", title: "Athletes", onPress: () => switchTab("/(tabs)/discover") },
      { key: "events", emoji: "📅", title: "Events", onPress: () => switchTab("/(tabs)/events") },
    ],
    []
  );

  return (
    <View style={styles.container}>
      {showHero ? (
        <SectionErrorBoundary label="feed-hero-banner" compact>
          <FeedHeroBanner
            onFindAthletes={() => switchTab("/(tabs)/discover")}
            onShareWorkout={() => openCreatePost()}
          />
        </SectionErrorBoundary>
      ) : null}

      {showStories || showQuickActions ? (
        <View style={styles.storiesShortcutsGroup}>
          {showStories ? (
            <SectionErrorBoundary label="feed-stories-carousel" compact>
              <FeedStoriesRow
                stories={stories}
                onStoryPress={onStoryPress}
                onAddStoryPress={openCreateStory}
                onViewAllPress={() => pushScreen("/stories/explore")}
              />
            </SectionErrorBoundary>
          ) : null}

          {showQuickActions ? (
            <SectionErrorBoundary label="feed-quick-actions" compact>
              <View nativeID="feed-shortcut-row">
                <FeedQuickActionCards actions={quickActions} />
              </View>
            </SectionErrorBoundary>
          ) : null}
        </View>
      ) : null}

      {showSuggestions && suggestions.length > 0 ? (
        <SectionErrorBoundary label="feed-suggestions-carousel" compact>
          <PeopleYouMayKnowCarousel
            suggestions={suggestions}
            followingIds={followingIds}
            onProfilePress={(username) => pushScreen(`/user/${username}`)}
            onFollowPress={onFollowPress}
            onDismissPress={onDismissPress}
            followLoadingId={followLoadingId}
            dismissLoadingId={dismissLoadingId}
          />
        </SectionErrorBoundary>
      ) : null}

      {showFeedTabs && onFeedTabChange ? (
        <FeedCategoryTabs
          tabs={HOME_FEED_TABS}
          active={feedTab}
          onChange={onFeedTabChange}
          accessibilityLabel="Home feed"
        />
      ) : null}
      {feedTab === "nutrition" ? (
        <Pressable
          style={styles.shareMeal}
          onPress={() => openCreatePost({ category: "nutrition" })}
          accessibilityRole="button"
          accessibilityLabel="Share a meal"
        >
          <Text style={styles.shareMealText}>+ Share a meal</Text>
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: "transparent",
    paddingHorizontal: spacing.md,
    paddingTop: feedLayout.feedChrome.paddingTop,
    paddingBottom: feedLayout.feedChrome.paddingBottom,
    gap: feedLayout.feedChrome.sectionGap,
  },
  storiesShortcutsGroup: {
    gap: spacing.xxs,
  },
  shareMeal: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
    paddingVertical: spacing.xs,
  },
  shareMealText: {
    ...typography.body,
    color: colors.accent,
    fontWeight: "700",
  },
});
