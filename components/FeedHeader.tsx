import { memo, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import type { FeedStory, SuggestedAthlete } from "@frennix/types";
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary";
import { FeedSearchSection } from "@/components/FeedSearchSection";
import {
  FeedHeroBanner,
  FeedQuickActionCards,
  FeedStoriesRow,
  PeopleYouMayKnowCarousel,
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
  onSearchFocusScroll?: () => void;
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
  onSearchFocusScroll,
}: FeedHeaderProps) {
  const [searchActive, setSearchActive] = useState(false);

  const quickActions = useMemo(
    () => [
      { key: "share", emoji: "🏋️", title: "Share", onPress: openCreatePost },
      { key: "stories", emoji: "🔍", title: "Explore", onPress: () => pushScreen("/stories/explore") },
      { key: "athletes", emoji: "🎯", title: "Athletes", onPress: () => switchTab("/(tabs)/discover") },
      { key: "events", emoji: "📅", title: "Events", onPress: () => switchTab("/(tabs)/events") },
    ],
    []
  );

  const chromeVisible = !searchActive;

  return (
    <View style={styles.container}>
      <View style={styles.paddedSection}>
        <SectionErrorBoundary label="feed-search-bar" compact>
          <FeedSearchSection
            onActiveChange={setSearchActive}
            onFocusScroll={onSearchFocusScroll}
          />
        </SectionErrorBoundary>
      </View>

      {chromeVisible && showHero ? (
        <View style={styles.paddedSection}>
          <SectionErrorBoundary label="feed-hero-banner" compact>
            <FeedHeroBanner
              onFindAthletes={() => switchTab("/(tabs)/discover")}
              onShareWorkout={openCreatePost}
            />
          </SectionErrorBoundary>
        </View>
      ) : null}

      {chromeVisible && (showStories || showQuickActions) ? (
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
              <FeedQuickActionCards actions={quickActions} />
            </SectionErrorBoundary>
          ) : null}
        </View>
      ) : null}

      {chromeVisible && showSuggestions && suggestions.length > 0 ? (
        <View style={styles.paddedSection}>
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
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: "transparent",
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    alignSelf: "stretch",
    flexShrink: 1,
    overflow: "hidden",
    paddingTop: feedLayout.feedChrome.paddingTop,
    paddingBottom: feedLayout.feedChrome.paddingBottom,
    gap: feedLayout.feedChrome.sectionGap,
  },
  paddedSection: {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    paddingHorizontal: spacing.md,
  },
  storiesShortcutsGroup: {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    overflow: "hidden",
    gap: spacing.xxs,
  },
});
