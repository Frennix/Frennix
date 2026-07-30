import { memo, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import type { FeedStory, SuggestedAthlete } from "@frennix/types";
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary";
import {
  FeedHeroBanner,
  FeedQuickActionCards,
  FeedStoriesRow,
  PeopleYouMayKnowCarousel,
  colors,
  feedLayout,
  spacing,
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
}: FeedHeaderProps) {
  const quickActions = useMemo(
    () => [
      { key: "share", emoji: "🏋️", title: "Share Workout", onPress: openCreatePost },
      { key: "stories", emoji: "📖", title: "Explore Stories", onPress: () => pushScreen("/stories/explore") },
      { key: "athletes", emoji: "🎯", title: "Find Athletes", onPress: () => switchTab("/(tabs)/discover") },
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
            onShareWorkout={openCreatePost}
          />
        </SectionErrorBoundary>
      ) : null}

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
          <View nativeID="feed-quick-actions-row">
            <FeedQuickActionCards actions={quickActions} />
          </View>
        </SectionErrorBoundary>
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
});
