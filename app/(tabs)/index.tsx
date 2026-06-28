import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import {
  getFeed,
  getFeedStories,
  getSuggestedAthletes,
  getErrorMessage,
  markStoryViewed,
  sendStoryReaction,
  sendStoryReply,
} from "@frennix/api";
import type { FeedStory, Post, StoryReactionEmoji } from "@frennix/types";
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
import { handleTabRetap, scrollFlatListToTop } from "@/lib/tab-scroll-registry";
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
import { EmptyState, FeedPostCardSkeleton, QueryErrorState, getSharedPostTargetId, colors, spacing } from "@frennix/ui";

export default function HomeScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const { openShare, shareSheet } = useSharePost(userId);
  const { openPostActions, postActionSheets } = usePostActions({
    userId,
    onShareInApp: (post) => openShare(post.shared_post ?? post),
  });
  const { toggleSavePost } = useSavePost(userId);
  const postReaction = usePostReaction(userId);
  const { followingIds, toggleFollow, followMutation } = useSuggestedFollow(userId);
  const { toggleLikePost } = useFeedLike(userId);
  const { openGallery, lightbox } = useImageLightbox();
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

  const handleStoryReaction = useCallback(
    async (storyUserId: string, postId: string, emoji: StoryReactionEmoji) => {
      if (!userId) return;
      await sendStoryReaction(userId, storyUserId, postId, emoji);
    },
    [userId]
  );

  const handleStoryReply = useCallback(
    async (storyUserId: string, text: string) => {
      if (!userId) return;
      await sendStoryReply(userId, storyUserId, text);
    },
    [userId]
  );

  const feedLoadStartedRef = useRef<number | null>(null);
  const feedPerfTrackedRef = useRef(false);
  const listRef = useRef<FlatList<FeedListRow>>(null);

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

  const handleScroll = useCallback(
    (event: Parameters<typeof handleFeedScroll>[0]) => {
      handleFeedScroll(event);
      const atTop = event.nativeEvent.contentOffset.y <= 8;
      setFeedAtTop((prev) => (prev === atTop ? prev : atTop));
    },
    [handleFeedScroll]
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

  const handleNewPostsBannerPress = useCallback(async () => {
    clearBanner();
    await handleRefresh();
    scrollFlatListToTop(listRef.current);
  }, [clearBanner, handleRefresh]);

  useTabScrollRegistration(
    "feed",
    useCallback(
      () =>
        handleTabRetap({
          isAtTop,
          scrollToTop: () => scrollFlatListToTop(listRef.current),
          refresh: () => {
            void handleRefresh();
          },
        }),
      [handleRefresh, isAtTop]
    )
  );

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

  const handleScrollEnd = useCallback(
    (event: Parameters<typeof onScrollEnd>[0]) => {
      onScrollEnd(event);
    },
    [onScrollEnd]
  );

  if (isError && posts.length === 0) {
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

  return (
    <View style={styles.container}>
      {postActionSheets}
      {shareSheet}
      {lightbox}
      <FeedStoryViewer
        stories={stories}
        visible={activeStoryIndex !== null}
        initialStoryIndex={activeStoryIndex ?? 0}
        onClose={() => setActiveStoryIndex(null)}
        onViewProfile={(username) => {
          setActiveStoryIndex(null);
          pushScreen(`/user/${username}`);
        }}
        onShareWorkout={() => {
          setActiveStoryIndex(null);
          openCreatePost();
        }}
        onMarkViewed={markStoryViewedOptimistic}
        onReact={handleStoryReaction}
        onReply={handleStoryReply}
      />
      {showBanner ? (
        <NewPostsBanner count={newPostCount} onPress={() => void handleNewPostsBannerPress()} />
      ) : null}
      <FlatList
        ref={listRef}
        data={listRows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={21}
        updateCellsBatchingPeriod={16}
        removeClippedSubviews={false}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { flexGrow: 1, paddingBottom: spacing.xl },
  emptyWrap: { padding: spacing.lg },
  initialSkeletons: { gap: 0 },
});
