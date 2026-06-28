import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import {
  getFeed,
  getFeedStories,
  getSuggestedAthletes,
  getErrorMessage,
  getStoryInsights,
  markStoryViewed,
  sendStoryChallenge,
  sendStoryInviteToTrain,
  sendStoryQuickReaction,
  sendStoryReply,
  trackStoryFollowFromStory,
  trackStoryProfileVisit,
} from "@frennix/api";
import {
  STORY_CHALLENGE_RESPONSES,
  type FeedStory,
  type Post,
  type StoryChallengeKey,
  type StoryQuickReactionEmoji,
} from "@frennix/types";
import { showAlert } from "@/lib/alerts";
import { useAuth } from "@/providers/AuthProvider";
import { FeedHeader } from "@/components/FeedHeader";
import { FeedListItem, type FeedListItemActions } from "@/components/FeedListItem";
import { AnimatedFeedListItem } from "@/components/AnimatedFeedListItem";
import { FeedStoryViewer } from "@/components/FeedStoryViewer";
import { useSuggestedFollow } from "@/lib/useSuggestedFollow";
import { usePostActions } from "@/lib/usePostActions";
import { useSharePost } from "@/lib/useSharePost";
import { useSavePost } from "@/lib/useSavePost";
import { usePostReaction } from "@/lib/usePostReaction";
import { openCreatePost, pushScreen } from "@/lib/press-utils";
import { handleTabRetap, scrollFlatListToTop, scrollScrollViewToTop } from "@/lib/tab-scroll-registry";
import { useScrollAtTop } from "@/lib/useScrollAtTop";
import { useTabScrollRegistration } from "@/lib/useTabScrollRegistration";
import { useFeedLike } from "@/lib/useFeedLike";
import { useFeedInfiniteScroll } from "@/lib/useFeedInfiniteScroll";
import { useFeedNewPostsBanner } from "@/lib/useFeedNewPostsBanner";
import { useGuardedRefresh } from "@/lib/useGuardedRefresh";
import type { FeedListRow } from "@/lib/feed-list-rows";
import { trackFeedLoad } from "@/lib/product-analytics";
import { useImageLightbox } from "@/lib/useImageLightbox";
import { NewPostsBanner } from "@/components/NewPostsBanner";
import { FeedScrollDebugOverlay } from "@/components/FeedScrollDebugOverlay";
import { FeedScrollTestView } from "@/components/FeedScrollTestView";
import { WebFeedScrollList } from "@/components/WebFeedScrollList";
import { EmptyState, FeedPostCardSkeleton, QueryErrorState, getSharedPostTargetId, colors, spacing } from "@frennix/ui";
import { flexFill, webVerticalScrollStyle } from "@/lib/flex-layout";
import { isFeedScrollTestMode } from "@/lib/feed-scroll-debug";
import { useFeedScrollDebug } from "@/lib/useFeedScrollDebug";
import { markFeedRender } from "@/lib/feed-render-trace";
import { markFeedHook } from "@/lib/feed-hook-trace";
import { EMERGENCY_BANNER_CLEARANCE } from "@/lib/emergency-debug";
import { useFeedRenderStateTrace } from "@/lib/useFeedRenderStateTrace";
import { FeedRenderTraceProbe } from "@/components/FeedRenderTraceProbe";
import { useFeedLayoutDiagnostics } from "@/lib/useFeedLayoutDiagnostics";
import { sampleFeedLayout } from "@/lib/feed-layout-diagnostics";

export default function HomeScreen() {
  markFeedRender("feed:HomeScreen:render");
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [storyInviteUserId, setStoryInviteUserId] = useState<string | null>(null);
  const { openShare, shareSheet, shareVisible } = useSharePost(userId);
  markFeedHook("share-post");
  const { openPostActions, postActionSheets } = usePostActions({
    userId,
    onShareInApp: (post) => openShare(post.shared_post ?? post),
  });
  markFeedHook("post-actions");
  const { toggleSavePost } = useSavePost(userId);
  markFeedHook("save-post");
  const postReaction = usePostReaction(userId);
  markFeedHook("post-reaction");
  const { followingIds, toggleFollow, followMutation } = useSuggestedFollow(userId);
  markFeedHook("suggested-follow");
  const { toggleLikePost } = useFeedLike(userId);
  markFeedHook("feed-like");
  const { openGallery, lightbox, lightboxVisible } = useImageLightbox();
  markFeedHook("image-lightbox");
  const [feedDebugCollapsed, setFeedDebugCollapsed] = useState(false);
  const [carouselIndices, setCarouselIndices] = useState<Record<string, number>>({});
  const setCarouselIndex = useCallback((postId: string, index: number) => {
    setCarouselIndices((current) => ({ ...current, [postId]: index }));
  }, []);

  const markStoryViewedOptimistic = useCallback(
    (storyUserId: string, postId: string | null) => {
      if (!userId || !postId) return;
      queryClient.setQueryData<FeedStory[]>(["feed-stories", userId], (current) =>
        current?.map((story) =>
          story.user_id === storyUserId ? { ...story, viewed: true } : story
        )
      );
      void markStoryViewed(userId, storyUserId, postId).catch(() => undefined);
    },
    [queryClient, userId]
  );

  const {
    data: stories = [],
    refetch: refetchStories,
    isRefetching: isStoriesRefetching,
  } = useQuery({
    queryKey: ["feed-stories", userId],
    queryFn: () => getFeedStories(userId),
    enabled: !!userId,
    staleTime: 60_000,
  });
  markFeedHook("stories-query");

  const handleStoryReact = useCallback(
    async (storyUserId: string, postId: string, emoji: StoryQuickReactionEmoji) => {
      if (!userId) return;
      await sendStoryQuickReaction(userId, storyUserId, postId, emoji);
    },
    [userId]
  );

  const handleStoryChallenge = useCallback(
    async (storyUserId: string, key: StoryChallengeKey) => {
      if (!userId) return;
      const challenge = STORY_CHALLENGE_RESPONSES.find((item) => item.key === key);
      const postId = stories.find((story) => story.user_id === storyUserId)?.last_workout?.post_id;
      if (!challenge) return;
      await sendStoryChallenge(userId, storyUserId, challenge.message, postId ?? null);
    },
    [userId, stories]
  );

  const handleStoryReply = useCallback(
    async (storyUserId: string, text: string) => {
      if (!userId) return;
      const postId = stories.find((story) => story.user_id === storyUserId)?.last_workout?.post_id;
      await sendStoryReply(userId, storyUserId, text, postId ?? null);
    },
    [userId, stories]
  );

  const handleStoryFollow = useCallback(
    (storyUserId: string, isFollowing: boolean) => {
      if (!userId || isFollowing) return;
      const postId = stories.find((story) => story.user_id === storyUserId)?.last_workout?.post_id ?? null;
      followMutation.mutate({ targetUserId: storyUserId, isFollowing: false });
      queryClient.setQueryData<FeedStory[]>(["feed-stories", userId], (current) =>
        current?.map((story) =>
          story.user_id === storyUserId ? { ...story, viewer_follows: true } : story
        )
      );
      void trackStoryFollowFromStory(userId, storyUserId, postId).catch(() => undefined);
    },
    [followMutation, queryClient, stories, userId]
  );

  const handleStoryInviteToTrain = useCallback(
    async (storyUserId: string, postId: string | null) => {
      if (!userId) return;
      setStoryInviteUserId(storyUserId);
      try {
        await sendStoryInviteToTrain(userId, storyUserId, postId);
        showAlert("Invite sent", "They'll get a notification to train with you.");
      } catch (error) {
        showAlert("Could not send invite", getErrorMessage(error));
      } finally {
        setStoryInviteUserId(null);
      }
    },
    [userId]
  );

  const feedLoadStartedRef = useRef<number | null>(null);
  const feedPerfTrackedRef = useRef(false);
  const listRef = useRef<FlatList<FeedListRow>>(null);
  const webScrollRef = useRef<ScrollView>(null);
  const useWebScroll = Platform.OS === "web";
  const listLayoutHeightRef = useRef(0);
  const contentHeightRef = useRef(0);
  const { height: viewportHeight } = useWindowDimensions();

  const {
    data,
    isLoading,
    isError,
    error,
    isSuccess: isFeedReady,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["feed", userId],
    queryFn: ({ pageParam }) => getFeed(userId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!userId,
    staleTime: 60_000,
    placeholderData: (previousData) => previousData,
  });
  markFeedHook("feed-query");

  const {
    data: suggestions = [],
    refetch: refetchSuggestions,
    isRefetching: isSuggestionsRefetching,
  } = useQuery({
    queryKey: ["suggested-athletes", userId],
    queryFn: () => getSuggestedAthletes(userId, 10),
    enabled: !!userId && isFeedReady,
    staleTime: 120_000,
  });
  markFeedHook("suggestions-query");

  const posts = useMemo(() => data?.pages.flatMap((page) => page.posts) ?? [], [data?.pages]);
  const pageCount = data?.pages.length ?? 0;
  const { onScroll, onScrollEnd, isAtTop } = useScrollAtTop();
  const [feedAtTop, setFeedAtTop] = useState(true);

  const {
    listRows,
    handleScroll: handleFeedScroll,
    onViewableItemsChanged,
    viewabilityConfig,
    visiblePostIds,
  } = useFeedInfiniteScroll({
    posts,
    pageCount,
    isFeedReady,
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    onScrollBase: onScroll,
  });
  markFeedHook("feed-infinite-scroll");

  const feedScrollTestMode = isFeedScrollTestMode();
  const storyVisible = activeStoryIndex !== null;

  useFeedLayoutDiagnostics({
    enabled: Platform.OS === "web" && !!userId && !feedScrollTestMode,
    overlays: {
      share: shareVisible,
      lightbox: lightboxVisible,
      story: storyVisible,
    },
  });

  const {
    enabled: feedDebugEnabled,
    snapshot: feedDebugSnapshot,
    reportMetrics: reportFeedDebugMetrics,
    reportScroll: reportFeedDebugScroll,
  } = useFeedScrollDebug({
    listRef: useWebScroll ? webScrollRef : listRef,
    scrollEnabled: !storyVisible,
    storyVisible,
    shareSheetVisible: shareVisible,
    lightboxVisible,
    viewportHeight,
  });
  markFeedHook("feed-scroll-debug");

  const handleScroll = useCallback(
    (event: Parameters<typeof handleFeedScroll>[0]) => {
      handleFeedScroll(event);
      const { contentOffset } = event.nativeEvent;
      reportFeedDebugScroll(contentOffset.y);
      const atTop = contentOffset.y <= 8;
      setFeedAtTop((prev) => (prev === atTop ? prev : atTop));
    },
    [handleFeedScroll, reportFeedDebugScroll]
  );

  const refreshFeedData = useCallback(async () => {
    await Promise.all([refetch(), refetchStories(), refetchSuggestions()]);
  }, [refetch, refetchStories, refetchSuggestions]);

  const handleRefresh = useGuardedRefresh(refreshFeedData, {
    errorTitle: "Could not refresh feed",
    haptic: true,
  });

  const { newPostCount, showBanner, clearBanner } = useFeedNewPostsBanner({
    userId,
    posts,
    atTop: feedAtTop,
    enabled: isFeedReady,
    onNewPostsWhileAtTop: () => {
      void handleRefresh();
    },
  });
  markFeedHook("new-posts-banner");

  const scrollFeedToTop = useCallback(() => {
    if (useWebScroll) scrollScrollViewToTop(webScrollRef.current);
    else scrollFlatListToTop(listRef.current);
  }, [useWebScroll]);

  const handleNewPostsBannerPress = useCallback(async () => {
    clearBanner();
    await handleRefresh();
    scrollFeedToTop();
  }, [clearBanner, handleRefresh, scrollFeedToTop]);

  useTabScrollRegistration(
    "feed",
    useCallback(
      () =>
        handleTabRetap({
          isAtTop,
          scrollToTop: scrollFeedToTop,
          refresh: () => {
            void handleRefresh();
          },
        }),
      [handleRefresh, isAtTop]
    )
  );
  markFeedHook("tab-scroll");

  useEffect(() => {
    if (userId) {
      feedLoadStartedRef.current = performance.now();
      feedPerfTrackedRef.current = false;
    }
  }, [userId]);

  useEffect(() => {
    if (!isFeedReady || feedPerfTrackedRef.current || feedLoadStartedRef.current == null) return;
    trackFeedLoad(performance.now() - feedLoadStartedRef.current, posts.length);
    feedPerfTrackedRef.current = true;
  }, [isFeedReady, posts.length]);

  const feedActionsRef = useRef<FeedListItemActions>({
    onPress: () => undefined,
    onAuthorPress: () => undefined,
    onCommentAuthorPress: () => undefined,
    onLike: () => undefined,
    onComment: () => undefined,
    onShare: () => undefined,
    onSave: () => undefined,
    onReaction: () => undefined,
    onModerationPress: () => undefined,
    onOwnerActionsPress: () => undefined,
    onMediaPress: () => undefined,
  });

  feedActionsRef.current = {
    onPress: (post: Post) => {
      pushScreen(`/post/${getSharedPostTargetId(post)}`);
    },
    onAuthorPress: (post: Post) => {
      if (post.author?.username) pushScreen(`/user/${post.author.username}`);
    },
    onCommentAuthorPress: (username: string) => {
      pushScreen(`/user/${username}`);
    },
    onLike: (post: Post) => {
      toggleLikePost(post.id);
    },
    onComment: (post: Post) => {
      pushScreen(`/post/${getSharedPostTargetId(post)}`);
    },
    onShare: (post: Post) => {
      openShare(post.shared_post ?? post);
    },
    onSave: (post: Post) => {
      toggleSavePost(post.id, !!post.saved_by_me);
    },
    onReaction: (post: Post, emoji: string) => {
      postReaction.mutate({
        postId: post.id,
        emoji,
        currentEmoji: post.my_reaction,
      });
    },
    onModerationPress: (post: Post) => {
      openPostActions(post);
    },
    onOwnerActionsPress: (post: Post) => {
      openPostActions(post);
    },
    onMediaPress: (post: Post, _uri: string, index: number) => {
      const displayPost = post.shared_post ?? post;
      setCarouselIndex(post.id, index);
      openGallery(displayPost.media_urls ?? [], index, (finalIndex) => {
        setCarouselIndex(post.id, finalIndex);
      }, {
        postType: displayPost.post_type,
        thumbnailUrl: displayPost.thumbnail_url,
      });
    },
  };

  const feedActions = useMemo<FeedListItemActions>(
    () => ({
      onPress: (post) => feedActionsRef.current.onPress(post),
      onAuthorPress: (post) => feedActionsRef.current.onAuthorPress(post),
      onCommentAuthorPress: (username) => feedActionsRef.current.onCommentAuthorPress(username),
      onLike: (post) => feedActionsRef.current.onLike(post),
      onComment: (post) => feedActionsRef.current.onComment(post),
      onShare: (post) => feedActionsRef.current.onShare(post),
      onSave: (post) => feedActionsRef.current.onSave(post),
      onReaction: (post, emoji) => feedActionsRef.current.onReaction(post, emoji),
      onModerationPress: (post) => feedActionsRef.current.onModerationPress(post),
      onOwnerActionsPress: (post) => feedActionsRef.current.onOwnerActionsPress(post),
      onMediaPress: (post, uri, index) => feedActionsRef.current.onMediaPress(post, uri, index),
    }),
    []
  );

  const renderItem = useCallback(
    ({ item }: { item: FeedListRow }) => {
      if (item.kind === "skeleton") {
        return <FeedPostCardSkeleton />;
      }

      markFeedRender("feed:ui:first-post-card", "data", item.post.id.slice(0, 8));

      return (
        <AnimatedFeedListItem
          post={item.post}
          userId={userId}
          actions={feedActions}
          mediaActive={visiblePostIds.has(item.post.id)}
          mediaPageIndex={carouselIndices[item.post.id] ?? 0}
          onMediaPageIndexChange={(pageIndex) => setCarouselIndex(item.post.id, pageIndex)}
        />
      );
    },
    [feedActions, userId, visiblePostIds, carouselIndices, setCarouselIndex]
  );

  const listHeader = useMemo(
    () => (
      <FeedRenderTraceProbe id="feed:ui:list-header">
        <FeedHeader
          stories={stories}
          suggestions={suggestions}
          followingIds={followingIds}
          followLoadingId={
            followMutation.isPending ? (followMutation.variables?.targetUserId ?? null) : null
          }
          onStoryPress={(story) => {
            const index = stories.findIndex((item) => item.user_id === story.user_id);
            setActiveStoryIndex(index >= 0 ? index : null);
          }}
          onFollowPress={(profileId) => toggleFollow(profileId)}
        />
      </FeedRenderTraceProbe>
    ),
    [
      stories,
      suggestions,
      followingIds,
      followMutation.isPending,
      followMutation.variables?.targetUserId,
      toggleFollow,
    ]
  );

  markFeedRender("feed:HomeScreen:hooks-complete");

  const feedBranch: "scroll-test" | "error" | "main" = feedScrollTestMode
    ? "scroll-test"
    : isError && posts.length === 0
      ? "error"
      : "main";

  const handleScrollEnd = useCallback(
    (event: Parameters<typeof onScrollEnd>[0]) => {
      onScrollEnd(event);
    },
    [onScrollEnd]
  );

  const activeStory = activeStoryIndex !== null ? stories[activeStoryIndex] ?? null : null;

  const { data: storyInsights } = useQuery({
    queryKey: ["story-insights", userId, activeStory?.last_workout?.post_id],
    queryFn: () => getStoryInsights(userId, activeStory!.last_workout!.post_id),
    enabled: Boolean(activeStory?.is_self && activeStory?.last_workout?.post_id && activeStoryIndex !== null),
    staleTime: 30_000,
  });
  markFeedHook("story-insights-query");

  const handleListLayout = useCallback(
    (height: number) => {
      listLayoutHeightRef.current = height;
      markFeedRender(
        "feed:ui:scroll-list-layout",
        "data",
        `listH=${Math.round(height)} contentH=${Math.round(contentHeightRef.current)}`
      );
      if (Platform.OS === "web") {
        sampleFeedLayout({
          share: shareVisible,
          lightbox: lightboxVisible,
          story: storyVisible,
        });
      }
      reportFeedDebugMetrics(height, contentHeightRef.current);
    },
    [reportFeedDebugMetrics, shareVisible, lightboxVisible, storyVisible]
  );

  const handleContentSizeChange = useCallback(
    (_width: number, height: number) => {
      contentHeightRef.current = height;
      if (listLayoutHeightRef.current > 0) {
        markFeedRender(
          "feed:ui:scroll-list-layout",
          "data",
          `listH=${Math.round(listLayoutHeightRef.current)} contentH=${Math.round(height)}`
        );
      }
      reportFeedDebugMetrics(listLayoutHeightRef.current, height);
    },
    [reportFeedDebugMetrics]
  );

  useFeedRenderStateTrace({
    userId,
    storiesCount: stories.length,
    postsCount: posts.length,
    listRowsCount: listRows.length,
    isLoading,
    isFeedReady,
    isError,
    isStoriesLoading: false,
    suggestionsCount: suggestions.length,
    branch: feedBranch,
  });

  useEffect(() => {
    if (!feedDebugEnabled) return;
    reportFeedDebugMetrics(listLayoutHeightRef.current, contentHeightRef.current);
  }, [feedDebugEnabled, isFeedReady, listRows.length, reportFeedDebugMetrics]);

  if (feedScrollTestMode) {
    markFeedRender("feed:branch:scroll-test");
    return (
      <View style={styles.container}>
        <FeedScrollTestView onScroll={(y) => reportFeedDebugScroll(y)} />
        {feedDebugEnabled ? (
          <FeedScrollDebugOverlay
            snapshot={{
              ...feedDebugSnapshot,
              scrollEventsFiring: feedDebugSnapshot.lastScrollAt != null && Date.now() - feedDebugSnapshot.lastScrollAt < 3000,
            }}
            collapsed={feedDebugCollapsed}
            onToggleCollapsed={() => setFeedDebugCollapsed((value) => !value)}
          />
        ) : null}
      </View>
    );
  }

  if (isError && posts.length === 0) {
    markFeedRender("feed:branch:error", "data", getErrorMessage(error));
    return (
      <View style={styles.container}>
        <QueryErrorState
          title="Could not load feed"
          message={getErrorMessage(error)}
          onRetry={() => void refetch()}
        />
      </View>
    );
  }

  markFeedRender("feed:branch:main");

  return (
    <FeedRenderTraceProbe id="feed:ui:container">
      <View
        style={styles.container}
        pointerEvents="box-none"
        nativeID="feed-root-container"
      >
        <View style={styles.feedScrollShell} collapsable={false} nativeID="feed-scroll-shell">
          {useWebScroll ? (
            <FeedRenderTraceProbe id="feed:ui:scroll-list" detail="WebFeedScrollList">
              <WebFeedScrollList
            scrollRef={webScrollRef}
            nativeID="feed-scroll-list"
            style={styles.feedList}
            contentContainerStyle={styles.list}
            scrollEnabled={!storyVisible}
            data={listRows}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            ListHeaderComponent={listHeader}
            ListEmptyComponent={
              isLoading ? (
                <View style={styles.initialSkeletons}>
                  <FeedPostCardSkeleton />
                  <FeedPostCardSkeleton />
                  <FeedPostCardSkeleton />
                </View>
              ) : (
                <View style={styles.emptyWrap}>
                  <EmptyState
                    title="Your feed is ready"
                    description="Follow athletes, join groups, or share your first workout photo, video, or progress update."
                    actionLabel="Share a workout"
                    onAction={() => openCreatePost()}
                  />
                </View>
              )
            }
            refreshControl={
              <RefreshControl
                refreshing={
                  isRefetching || isStoriesRefetching || isSuggestionsRefetching
                }
                onRefresh={() => void handleRefresh()}
                tintColor={colors.accent}
                colors={[colors.accent]}
                progressBackgroundColor={colors.surface}
              />
            }
            onLayout={(height) => handleListLayout(height)}
            onContentSizeChange={handleContentSizeChange}
            onScroll={handleScroll}
            onScrollEndDrag={handleScrollEnd}
            onMomentumScrollEnd={handleScrollEnd}
          />
            </FeedRenderTraceProbe>
        ) : (
          <FeedRenderTraceProbe id="feed:ui:scroll-list" detail="FlatList">
          <FlatList
            ref={listRef}
            style={styles.feedList}
            data={listRows}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            scrollEnabled={!storyVisible}
            nestedScrollEnabled
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={21}
            updateCellsBatchingPeriod={16}
            removeClippedSubviews={false}
            onLayout={(event) => handleListLayout(event.nativeEvent.layout.height)}
            onContentSizeChange={handleContentSizeChange}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            onScroll={handleScroll}
            onScrollEndDrag={handleScrollEnd}
            onMomentumScrollEnd={handleScrollEnd}
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl
                refreshing={
                  isRefetching || isStoriesRefetching || isSuggestionsRefetching
                }
                onRefresh={() => void handleRefresh()}
                tintColor={colors.accent}
                colors={[colors.accent]}
                progressBackgroundColor={colors.surface}
              />
            }
            onEndReachedThreshold={2}
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
            }}
            ListHeaderComponent={listHeader}
            ListEmptyComponent={
              isLoading ? (
                <View style={styles.initialSkeletons}>
                  <FeedPostCardSkeleton />
                  <FeedPostCardSkeleton />
                  <FeedPostCardSkeleton />
                </View>
              ) : (
                <View style={styles.emptyWrap}>
                  <EmptyState
                    title="Your feed is ready"
                    description="Follow athletes, join groups, or share your first workout photo, video, or progress update."
                    actionLabel="Share a workout"
                    onAction={() => openCreatePost()}
                  />
                </View>
              )
            }
            renderItem={renderItem}
          />
          </FeedRenderTraceProbe>
        )}
      </View>
      {showBanner && !storyVisible ? (
        <NewPostsBanner count={newPostCount} onPress={() => void handleNewPostsBannerPress()} />
      ) : null}
      <FeedRenderTraceProbe id="feed:ui:post-action-sheets">{postActionSheets}</FeedRenderTraceProbe>
      <FeedRenderTraceProbe id="feed:ui:share-sheet">{shareSheet}</FeedRenderTraceProbe>
      <FeedRenderTraceProbe id="feed:ui:lightbox">{lightbox}</FeedRenderTraceProbe>
      <FeedRenderTraceProbe id="feed:ui:story-viewer">
      <FeedStoryViewer
        stories={stories}
        visible={activeStoryIndex !== null}
        initialStoryIndex={activeStoryIndex ?? 0}
        onClose={() => setActiveStoryIndex(null)}
        onViewProfile={(username) => {
          setActiveStoryIndex(null);
          pushScreen(`/user/${username}`);
        }}
        onViewProfileFromStory={(storyUserId, username) => {
          const postId = stories.find((item) => item.user_id === storyUserId)?.last_workout?.post_id ?? null;
          void trackStoryProfileVisit(userId, storyUserId, postId).catch(() => undefined);
          setActiveStoryIndex(null);
          pushScreen(`/user/${username}`);
        }}
        onShareWorkout={() => {
          setActiveStoryIndex(null);
          openCreatePost();
        }}
        onMarkViewed={markStoryViewedOptimistic}
        onReact={handleStoryReact}
        onChallenge={handleStoryChallenge}
        onReply={handleStoryReply}
        onFollow={handleStoryFollow}
        onInviteToTrain={handleStoryInviteToTrain}
        storyInsights={storyInsights ?? null}
        followLoading={
          followMutation.isPending
            ? followMutation.variables?.targetUserId === activeStory?.user_id
            : false
        }
        inviteLoading={
          storyInviteUserId !== null && storyInviteUserId === activeStory?.user_id
        }
      />
      </FeedRenderTraceProbe>
      {feedDebugEnabled ? (
        <FeedScrollDebugOverlay
          snapshot={feedDebugSnapshot}
          collapsed={feedDebugCollapsed}
          onToggleCollapsed={() => setFeedDebugCollapsed((value) => !value)}
        />
      ) : null}
      </View>
    </FeedRenderTraceProbe>
  );
}

const styles = StyleSheet.create({
  container: { ...flexFill, backgroundColor: colors.background },
  feedScrollShell: { ...flexFill },
  feedList: { ...flexFill, ...webVerticalScrollStyle },
  list: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
    ...(Platform.OS === "web" ? { paddingTop: EMERGENCY_BANNER_CLEARANCE } : null),
  },
  emptyWrap: { padding: spacing.lg },
  initialSkeletons: { gap: 0 },
});
