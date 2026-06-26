import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Platform, RefreshControl, StyleSheet, View } from "react-native";
import { getFeed, getFeedStories, getSuggestedAthletes } from "@frennix/api";
import type { FeedStory, Post } from "@frennix/types";
import { useAuth } from "@/providers/AuthProvider";
import { FeedHeader } from "@/components/FeedHeader";
import { FeedListItem, type FeedListItemActions } from "@/components/FeedListItem";
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
import { trackFeedLoad } from "@/lib/product-analytics";
import { useImageLightbox } from "@/lib/useImageLightbox";
import { EmptyState, FeedPostCardSkeleton, getSharedPostTargetId, colors, spacing } from "@frennix/ui";

export default function HomeScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const [activeStory, setActiveStory] = useState<FeedStory | null>(null);
  const { openShare, shareSheet } = useSharePost(userId);
  const { openPostActions, postActionSheets } = usePostActions({
    userId,
    onShareInApp: (post) => openShare(post.shared_post ?? post),
  });
  const { toggleSavePost } = useSavePost(userId);
  const postReaction = usePostReaction(userId);
  const { followingIds, toggleFollow, followMutation } = useSuggestedFollow(userId);
  const { toggleLikePost } = useFeedLike(userId);
  const { openImage, lightbox } = useImageLightbox();
  const feedLoadStartedRef = useRef<number | null>(null);
  const feedPerfTrackedRef = useRef(false);
  const listRef = useRef<FlatList<Post>>(null);

  const {
    data,
    dataUpdatedAt,
    isLoading,
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
  const { onScroll, isAtTop } = useScrollAtTop();

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetch(), refetchStories(), refetchSuggestions()]);
  }, [refetch, refetchStories, refetchSuggestions]);

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
    onMediaPress: (_post: Post, uri: string) => {
      openImage(uri);
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
      onMediaPress: (post, uri) => feedActionsRef.current.onMediaPress(post, uri),
    }),
    []
  );

  const renderItem = useCallback(
    ({ item }: { item: Post }) => (
      <FeedListItem post={item} userId={userId} actions={feedActions} />
    ),
    [feedActions, userId]
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
        onStoryPress={(story) => setActiveStory(story)}
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

  return (
    <View style={styles.container}>
      {postActionSheets}
      {shareSheet}
      {lightbox}
      <FeedStoryViewer
        story={activeStory}
        visible={Boolean(activeStory)}
        onClose={() => setActiveStory(null)}
        onViewProfile={(username) => {
          setActiveStory(null);
          pushScreen(`/user/${username}`);
        }}
        onViewPost={(postId) => {
          setActiveStory(null);
          pushScreen(`/post/${postId}`);
        }}
        onShareWorkout={() => {
          setActiveStory(null);
          openCreatePost();
        }}
      />
      <FlatList
        ref={listRef}
        data={posts}
        extraData={dataUpdatedAt}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={11}
        updateCellsBatchingPeriod={32}
        removeClippedSubviews={Platform.OS !== "web"}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching || isStoriesRefetching || isSuggestionsRefetching}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
          />
        }
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        onEndReachedThreshold={0.65}
        ListHeaderComponent={listHeader}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.footerSkeletons}>
              <FeedPostCardSkeleton />
              <FeedPostCardSkeleton />
            </View>
          ) : null
        }
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
  footer: { paddingVertical: spacing.lg },
  initialSkeletons: { gap: 0 },
  footerSkeletons: { gap: 0 },
});
