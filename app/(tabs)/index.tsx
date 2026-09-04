import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { frennixRefreshControlProps } from '@/lib/screen-shell';
import {
  getFeed,
  getFeedCore,
  enrichPostsWithInteractions,
  applyDefaultPostInteractions,
  getFeedStories,
  getSuggestedAthletes,
  getDismissedSuggestionIds,
  peekFeedFollowingIds,
  getErrorMessage,
  getDedicatedStoryInsights,
  getDedicatedStoryAnalytics,
  getStoryViewers,
  getStoryReactions,
  joinStoryChallenge,
  markDedicatedStoryViewed,
  markStoryCommitmentComplete,
  sendDedicatedStoryReaction,
  sendDedicatedStoryReply,
  sendStoryChallenge,
  sendStoryEventInvite,
  trackStoryFollowFromStory,
  trackStoryProfileVisit,
} from "@frennix/api";
import {
  STORY_CHALLENGE_RESPONSES,
  normalizePostMediaItems,
  type FeedStory,
  type Post,
  type StoryChallengeKey,
  type StoryQuickReactionEmoji,
} from "@frennix/types";
import type { ImmersiveVideoGalleryContext } from "@/lib/immersive-video-gallery";
import {
  buildFeedVideoPlaylistFromPosts,
  buildPlaylistEntriesFromPosts,
} from "@/lib/immersive-video-playlist";
import type { ImmersiveVideoPlaylistState } from "@/lib/immersive-video-playlist-state";
import { usesMobileWebCommentsRoute } from "@/lib/mobile-web-comments-route";
import {
  requestFeedScrollReturnRestore,
  saveFeedScrollReturnState,
  scrollFeedToPost,
} from "@/lib/web-feed-scroll-restore";
import { showAlert } from "@/lib/alerts";
import { useAuth } from "@/providers/AuthProvider";
import { FeedBackground } from "@/components/FeedBackground";
import { UndoSnackbar } from "@/components/UndoSnackbar";
import { FeedEmptyMotivation } from "@/components/FeedEmptyMotivation";
import { FeedHeader } from "@/components/FeedHeader";
import { FeedListItem, type FeedListItemActions } from "@/components/FeedListItem";
import { AnimatedFeedListItem } from "@/components/AnimatedFeedListItem";
import { FeedStoryViewer } from "@/components/FeedStoryViewer";
import { StoryAnalyticsModal } from "@/components/story/StoryAnalyticsModal";
import { StoryViewersModal } from "@/components/story/StoryViewersModal";
import { StoryReactionsModal } from "@/components/story/StoryReactionsModal";
import { useStoryViewersRealtime } from "@/lib/useStoryViewersRealtime";
import { useSuggestedFollow } from "@/lib/useSuggestedFollow";
import { useSuggestionDismissUndo } from "@/lib/useSuggestionDismissUndo";
import { usePostActions } from "@/lib/usePostActions";
import { useSharePost } from "@/lib/useSharePost";
import { useSavePost } from "@/lib/useSavePost";
import { usePostReaction } from "@/lib/usePostReaction";
import { openCreatePost, openCreateStory, pushScreen } from "@/lib/press-utils";
import { openStoryWorkoutInvite } from "@/lib/story-calendar-invite";
import { usePostInteraction } from "@/lib/usePostInteraction";
import { useFeedCommentsSheet } from "@/lib/useFeedCommentsSheet";
import { handleTabRetap, scrollFlatListToTop, scrollScrollViewToTop } from "@/lib/tab-scroll-registry";
import { useScrollAtTop } from "@/lib/useScrollAtTop";
import { useTabScrollRegistration } from "@/lib/useTabScrollRegistration";
import { useFeedLike } from "@/lib/useFeedLike";
import { useFeedInfiniteScroll } from "@/lib/useFeedInfiniteScroll";
import { useFeedNewPostsBanner } from "@/lib/useFeedNewPostsBanner";
import { useGuardedRefresh } from "@/lib/useGuardedRefresh";
import type { FeedListRow } from "@/lib/feed-list-rows";
import { hydrateFeedCache, hydrateFeedCacheSync, writeFeedCache } from "@/lib/feed-cache";
import { mergeEnrichedFeedPage } from "@/lib/feed-enrichment-merge";
import {
  markFeedCacheHydrated,
  markFeedPerf,
  markFirstFeedMediaReady,
  reportFeedPerfReady,
  startFeedPerfSession,
} from "@/lib/feed-performance";
import { useImageLightbox } from "@/lib/useImageLightbox";
import { NewPostsBanner } from "@/components/NewPostsBanner";
import { LocationFeedBanner } from "@/components/LocationFeedBanner";
import { useLocationFeedBanner } from "@/lib/useLocationFeedBanner";
import { FeedScrollDebugOverlay } from "@/components/FeedScrollDebugOverlay";
import { FeedScrollTestView } from "@/components/FeedScrollTestView";
import { WebFeedScrollList } from "@/components/WebFeedScrollList";
import { FeedPostCardSkeleton, FeedVideoPlaybackGate, QueryErrorState, getSharedPostTargetId, colors, spacing, buildFeedVideoPlaybackId, captureFeedVideoForFullscreen, setFeedVideoFullscreenHandoff } from "@frennix/ui";
import { flexFill, webScrollSurface, webTabSceneShell } from "@/lib/flex-layout";
import { webTabSceneContainerStyle } from "@/lib/web-tab-scene-layout";
import { isFeedScrollTestMode } from "@/lib/feed-scroll-debug";
import { useFeedScrollDebug } from "@/lib/useFeedScrollDebug";
import { markFeedRender } from "@/lib/feed-render-trace";
import { markFeedHook } from "@/lib/feed-hook-trace";
import { useFeedRenderStateTrace } from "@/lib/useFeedRenderStateTrace";
import { FeedRenderTraceProbe } from "@/components/FeedRenderTraceProbe";
import { StartupMountProbe } from "@/components/StartupMountProbe";
import { TabScreenBoundary } from "@/components/TabScreenBoundary";
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary";
import { isFeedIsolateDisabled } from "@/lib/feed-isolate";
import { recordWebStartupCheckpoint } from "@/lib/web-startup-checkpoints";
import { requestSafariVisualViewportRemeasure } from "@/lib/safari-visual-viewport";
import { restoreWebDocumentScrollLock } from "@/lib/web-modal-scroll-lock";
import { applyPendingFeedScrollReturnIfNeeded, registerFeedScrollController, trackFeedScrollPosition } from "@/lib/web-feed-scroll-restore";
import { useFeedScrollBottomPadding } from "@/lib/use-feed-scroll-bottom-padding";
import { hideFrennixBootShell } from "@/lib/hide-boot-shell";

export default function HomeScreen() {
  markFeedRender("feed:HomeScreen:render");
  const { session, profile: viewerProfile } = useAuth();
  const userId = session?.user.id ?? "";

  useEffect(() => {
    if (Platform.OS === "web") {
      recordWebStartupCheckpoint("feed-route:mounted");
    }
  }, []);
  const isolateStories = isFeedIsolateDisabled("stories");
  const isolateFeedList = isFeedIsolateDisabled("feed-list");
  const isolatePostCards = isFeedIsolateDisabled("post-cards");
  const isolateVideo = isFeedIsolateDisabled("video");
  const isolatePullRefresh = isFeedIsolateDisabled("pull-to-refresh");
  const queryClient = useQueryClient();
  const feedStartupRef = useRef<string | null>(null);
  const feedEnrichGenRef = useRef(0);
  const firstPostPaintMarkedRef = useRef(false);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [storyInviteUserId, setStoryInviteUserId] = useState<string | null>(null);
  const [viewersModalVisible, setViewersModalVisible] = useState(false);
  const [reactionsModalVisible, setReactionsModalVisible] = useState(false);
  const [analyticsModalVisible, setAnalyticsModalVisible] = useState(false);
  const [activeInsightStoryId, setActiveInsightStoryId] = useState<string | null>(null);
  const [activeInsightSlideId, setActiveInsightSlideId] = useState<string | null>(null);
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
  const { toggleLikePost } = useFeedLike(userId);
  markFeedHook("feed-like");
  const { openGallery, lightbox, lightboxVisible, closeGallery } = useImageLightbox();
  markFeedHook("image-lightbox");
  const [feedDebugCollapsed, setFeedDebugCollapsed] = useState(false);
  const [carouselIndices, setCarouselIndices] = useState<Record<string, number>>({});
  const [storiesDeferred, setStoriesDeferred] = useState(false);
  const [deferFeedSecondary, setDeferFeedSecondary] = useState(false);
  const setCarouselIndex = useCallback((postId: string, index: number) => {
    setCarouselIndices((current) => ({ ...current, [postId]: index }));
  }, []);

  const { openComments, commentsSheet, commentsVisible } = useFeedCommentsSheet({
    userId,
    authorProfile: viewerProfile ?? undefined,
  });
  markFeedHook("feed-comments-sheet");

  const {
    activePost,
    interactionVisible,
    openInteraction,
    interactionSheet,
  } = usePostInteraction({
    userId,
    onLike: (post) => toggleLikePost(post.id),
    onReaction: (post, emoji) => {
      postReaction.mutate({
        postId: post.id,
        emoji,
        currentEmoji: post.my_reaction,
      });
    },
    onReply: (post, draft) => {
      openComments(post, draft ? { draft } : undefined);
    },
    onShare: (post) => openShare(post.shared_post ?? post),
    onSave: (post) => toggleSavePost(post.id, !!post.saved_by_me),
    onViewProfile: (post) => {
      if (post.author?.username) pushScreen(`/user/${post.author.username}`);
    },
    onViewMedia: (post, mediaIndex) => {
      const displayPost = post.shared_post ?? post;
      setCarouselIndex(post.id, mediaIndex);
      openGallery(displayPost.media_urls ?? [], mediaIndex, (finalIndex) => {
        setCarouselIndex(post.id, finalIndex);
      }, {
        postType: displayPost.post_type,
        thumbnailUrl: displayPost.thumbnail_url,
      });
    },
  });
  markFeedHook("post-interaction");

  const markStoryViewedOptimistic = useCallback(
    (storyUserId: string, storyId: string | null, slideId: string | null) => {
      if (!userId || !storyId) return;
      queryClient.setQueryData<FeedStory[]>(["feed-stories", userId], (current) =>
        current?.map((story) =>
          story.user_id === storyUserId ? { ...story, viewed: true } : story
        )
      );
      void markDedicatedStoryViewed(userId, storyId, slideId, storyUserId).catch(() => undefined);
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
    enabled: !!userId && storiesDeferred && !isolateStories,
    staleTime: 60_000,
  });
  markFeedHook("stories-query");

  const { followingIds, toggleFollow, followMutation, isFollowing } = useSuggestedFollow(userId, {
    enabled: deferFeedSecondary,
  });
  markFeedHook("suggested-follow");

  const STRONG_WORK_EMOJI = "💪";

  const buildImmersiveVideoContext = useCallback(
    (post: Post): ImmersiveVideoGalleryContext | undefined => {
      if (!usesMobileWebCommentsRoute()) return undefined;
      const displayPost = post.shared_post ?? post;
      const authorId = post.author?.id;
      const showFollow = Boolean(authorId && authorId !== userId && !isFollowing(authorId));
      return {
        postActions: {
          post,
          onLike: () => toggleLikePost(post.id),
          onRespect: () =>
            postReaction.mutate({
              postId: post.id,
              emoji: STRONG_WORK_EMOJI,
              currentEmoji: post.my_reaction,
            }),
          onComment: () => {
            /* Overlay shell opens comments without unmounting the viewer. */
          },
          onShare: () => openShare(post.shared_post ?? post),
          onMore: () => openPostActions(post),
          onAuthorPress: () => {
            if (post.author?.username) pushScreen(`/user/${post.author.username}`);
          },
          onFollow: authorId ? () => toggleFollow(authorId) : undefined,
          showFollow,
        },
      };
    },
    [
      isFollowing,
      openPostActions,
      openShare,
      postReaction,
      toggleFollow,
      toggleLikePost,
      userId,
    ]
  );

  useQuery({
    queryKey: ["dismissed-suggestion-ids", userId],
    queryFn: () => getDismissedSuggestionIds(userId),
    enabled: !!userId && deferFeedSecondary,
    staleTime: 120_000,
  });
  markFeedHook("dismissed-suggestions-query");

  const { pendingDismiss, dismissSuggestionRequest, undoDismiss } = useSuggestionDismissUndo(
    userId,
    viewerProfile
  );
  markFeedHook("suggestion-dismiss-undo");

  const handleStoryReact = useCallback(
    async (
      storyUserId: string,
      storyId: string,
      emoji: StoryQuickReactionEmoji,
      slideId?: string | null
    ) => {
      if (!userId) return;
      await sendDedicatedStoryReaction(userId, storyUserId, storyId, emoji, slideId);
    },
    [userId]
  );

  const handleStoryChallenge = useCallback(
    async (storyUserId: string, key: StoryChallengeKey) => {
      if (!userId) return;
      const challenge = STORY_CHALLENGE_RESPONSES.find((item) => item.key === key);
      const storyId =
        stories.find((story) => story.user_id === storyUserId)?.active_stories.at(-1)?.id ?? null;
      if (!challenge || !storyId) return;
      await sendStoryChallenge(userId, storyUserId, challenge.message, storyId, { isDedicated: true });
    },
    [userId, stories]
  );

  const handleStoryReply = useCallback(
    async (storyUserId: string, text: string, storyId?: string | null) => {
      if (!userId || !storyId) return;
      await sendDedicatedStoryReply(userId, storyUserId, text, storyId);
    },
    [userId]
  );

  const handleStoryFollow = useCallback(
    (storyUserId: string, isFollowing: boolean) => {
      if (!userId || isFollowing) return;
      const storyId =
        stories.find((story) => story.user_id === storyUserId)?.active_stories.at(-1)?.id ?? null;
      followMutation.mutate({ targetUserId: storyUserId, isFollowing: false });
      queryClient.setQueryData<FeedStory[]>(["feed-stories", userId], (current) =>
        current?.map((story) =>
          story.user_id === storyUserId ? { ...story, viewer_follows: true } : story
        )
      );
      if (storyId) {
        void trackStoryFollowFromStory(userId, storyUserId, storyId, { isDedicated: true }).catch(
          () => undefined
        );
      }
    },
    [followMutation, queryClient, stories, userId]
  );

  const handleStoryEventInvite = useCallback(
    async (storyUserId: string, storyId: string) => {
      if (!userId) return;
      setStoryInviteUserId(storyUserId);
      try {
        await sendStoryEventInvite(userId, storyUserId, storyId);
        showAlert("Invite sent", "Your event invite was sent as a message.");
      } catch (error) {
        showAlert("Could not invite", getErrorMessage(error));
      } finally {
        setStoryInviteUserId(null);
      }
    },
    [userId]
  );

  const handleDiscoverStoryTag = useCallback((tag: string) => {
    setActiveStoryIndex(null);
    pushScreen({ pathname: "/stories/discover", params: { tag } });
  }, []);

  const handleDiscoverStoryLocation = useCallback((location: string) => {
    setActiveStoryIndex(null);
    pushScreen({ pathname: "/stories/discover", params: { location } });
  }, []);

  const handleJoinStoryChallenge = useCallback(
    async (
      storyUserId: string,
      storyId: string,
      options: { challengeId?: string | null; trainingChallengeId?: string | null }
    ) => {
      if (!userId) return;
      try {
        await joinStoryChallenge(
          userId,
          storyUserId,
          storyId,
          options.challengeId,
          options.trainingChallengeId
        );
        void queryClient.invalidateQueries({ queryKey: ["story-challenge-joins", storyId] });
        showAlert("You're in!", "Challenge accepted — let's train.");
      } catch (error) {
        showAlert("Could not join", getErrorMessage(error));
      }
    },
    [queryClient, userId]
  );

  const handleStoryInviteToTrain = useCallback(
    (storyUserId: string, _postId: string | null) => {
      const feedStory = stories.find((item) => item.user_id === storyUserId);
      const dedicatedStory = feedStory?.active_stories.at(-1) ?? null;
      openStoryWorkoutInvite({
        partnerId: storyUserId,
        partnerUsername: feedStory?.profile.username,
        workoutType: dedicatedStory?.workout_tag ?? null,
        storyId: dedicatedStory?.id ?? null,
      });
    },
    [stories]
  );

  const handleMarkStoryCommitmentComplete = useCallback(
    async (storyId: string) => {
      if (!userId) return;
      try {
        await markStoryCommitmentComplete(storyId, userId);
        void queryClient.invalidateQueries({ queryKey: ["story-commitment", storyId] });
        showAlert("Completed", "Your workout commitment is marked complete.");
      } catch (error) {
        showAlert("Could not update", getErrorMessage(error));
      }
    },
    [queryClient, userId]
  );

  const feedLoadStartedRef = useRef<number | null>(null);
  const feedPerfTrackedRef = useRef(false);

  const listRef = useRef<FlatList<FeedListRow>>(null);
  const webScrollRef = useRef<ScrollView>(null);
  const useWebScroll = Platform.OS === "web";
  const feedScrollBottomPadding = useFeedScrollBottomPadding();
  const listContentStyle = useMemo(
    () => [styles.list, { paddingBottom: feedScrollBottomPadding }],
    [feedScrollBottomPadding]
  );
  const webContainerStyle = webTabSceneContainerStyle();
  const listLayoutHeightRef = useRef(0);
  const contentHeightRef = useRef(0);
  const lastFeedScrollYRef = useRef(0);
  const { height: viewportHeight } = useWindowDimensions();

  const {
    data,
    isLoading,
    isFetching,
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
    queryFn: async ({ pageParam }) => {
      if (pageParam) {
        markFeedPerf("feed_page_next_start");
        const page = await getFeed(userId, pageParam);
        markFeedPerf("feed_page_next_ready", { post_count: page.posts.length });
        return page;
      }

      markFeedPerf("feed_query_start");
      const enrichGen = ++feedEnrichGenRef.current;
      const core = await getFeedCore(userId, undefined, undefined, (phase, detail) => {
        if (phase === "scope" && detail?.start) markFeedPerf("feed_scope_start");
        if (phase === "scope" && detail?.author_count != null) markFeedPerf("feed_scope_ready", detail);
        if (phase === "posts" && detail?.start) markFeedPerf("feed_posts_query_start");
        if (phase === "posts" && detail?.count != null) markFeedPerf("feed_posts_query_ready", detail);
      });
      markFeedPerf("feed_filtering_ready", { post_count: core.posts.length });

      const page = {
        posts: core.posts.map(applyDefaultPostInteractions),
        nextCursor: core.nextCursor,
      };
      markFeedPerf("feed_data_in_react", { post_count: page.posts.length });
      markFeedPerf("feed_page_1_ready", { post_count: page.posts.length, enriched: false });

      if (core.posts.length) {
        void enrichPostsWithInteractions(core.posts, userId)
          .then((enrichedPosts) => {
            if (enrichGen !== feedEnrichGenRef.current) return;
            mergeEnrichedFeedPage(queryClient, userId, 0, enrichedPosts);
            markFeedPerf("feed_enrichment_complete", { post_count: enrichedPosts.length });
          })
          .catch((enrichmentError) => {
            console.warn("[feed] background enrichment failed", enrichmentError);
          });
      }

      return page;
    },
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
    queryKey: ["discover-suggestions", userId],
    queryFn: () => {
      const cachedFollowing = queryClient.getQueryData<string[]>(["following-ids", userId]);
      const cachedDismissed = queryClient.getQueryData<string[]>(["dismissed-suggestion-ids", userId]);
      return getSuggestedAthletes(userId, 20, {
        viewer: viewerProfile,
        followingIds: cachedFollowing,
        dismissedIds: cachedDismissed,
      });
    },
    select: (athletes) => athletes.slice(0, 10),
    enabled: !!userId && deferFeedSecondary,
    staleTime: 120_000,
  });
  markFeedHook("suggestions-query");

  const posts = useMemo(() => data?.pages.flatMap((page) => page.posts) ?? [], [data?.pages]);

  useEffect(() => {
    if (Platform.OS !== "web" || !userId) return;
    if (isLoading || isFetching) {
      recordWebStartupCheckpoint("feed-request:started");
      return;
    }
    if (isError) {
      recordWebStartupCheckpoint("feed-request:failed", {
        message: getErrorMessage(error).slice(0, 120),
      });
      return;
    }
    if (isFeedReady) {
      recordWebStartupCheckpoint("feed-request:succeeded", { postCount: posts.length });
    }
  }, [userId, isLoading, isFetching, isError, isFeedReady, error, posts.length]);

  const showFeedSkeleton = posts.length === 0 && isLoading;
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
  /** Only hard-lock feed scroll for the story viewer. Modals/lightbox block touches via portal — toggling scrollEnabled causes Safari to drop pan-y binding (BUG-004). */
  const feedScrollEnabled = !storyVisible;

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "web") return;
      hideFrennixBootShell();
      restoreWebDocumentScrollLock();
      requestSafariVisualViewportRemeasure();
      applyPendingFeedScrollReturnIfNeeded();
    }, [])
  );

  const {
    enabled: feedDebugEnabled,
    snapshot: feedDebugSnapshot,
    reportMetrics: reportFeedDebugMetrics,
    reportScroll: reportFeedDebugScroll,
  } = useFeedScrollDebug({
    listRef: useWebScroll ? webScrollRef : listRef,
    scrollEnabled: feedScrollEnabled,
    storyVisible,
    shareSheetVisible: shareVisible,
    lightboxVisible,
    viewportHeight,
  });
  markFeedHook("feed-scroll-debug");

  useEffect(() => {
    if (!useWebScroll) {
      registerFeedScrollController(null);
      return;
    }

    registerFeedScrollController({
      scrollTo: (y) => {
        webScrollRef.current?.scrollTo({ y, animated: false });
      },
      readTrackedScrollY: () => lastFeedScrollYRef.current,
    });

    return () => registerFeedScrollController(null);
  }, [useWebScroll]);

  const handleScroll = useCallback(
    (event: Parameters<typeof handleFeedScroll>[0]) => {
      handleFeedScroll(event);
      const { contentOffset } = event.nativeEvent;
      lastFeedScrollYRef.current = contentOffset.y;
      if (Platform.OS === "web") {
        trackFeedScrollPosition(contentOffset.y);
      }
      if (contentOffset.y > 120) {
        setDeferFeedSecondary(true);
      }
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

  const { showLocationBanner, dismissLocationBanner } = useLocationFeedBanner(viewerProfile);
  markFeedHook("location-feed-banner");

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

  // Never call queryClient.setQueryData during render — it breaks React startup on Safari web.
  useLayoutEffect(() => {
    if (!userId || feedStartupRef.current === userId) return;
    feedStartupRef.current = userId;
    startFeedPerfSession(userId);
    markFeedPerf("route_mount");
    if (session) markFeedPerf("auth_session_ready");
    if (viewerProfile) markFeedPerf("profile_ready");
    if (hydrateFeedCacheSync(queryClient, userId)) {
      const cachedPosts =
        queryClient
          .getQueryData<{ pages: { posts: Post[] }[] }>(["feed", userId])
          ?.pages.flatMap((page) => page.posts) ?? [];
      markFeedCacheHydrated(cachedPosts.length);
    }
  }, [queryClient, session, userId, viewerProfile]);

  useEffect(() => {
    if (!userId) return;
    void hydrateFeedCache(queryClient, userId).then((hydrated) => {
      if (!hydrated) return;
      const cachedPosts =
        queryClient.getQueryData<{ pages: { posts: Post[] }[] }>(["feed", userId])?.pages.flatMap(
          (page) => page.posts
        ) ?? [];
      markFeedCacheHydrated(cachedPosts.length);
    });
  }, [queryClient, userId]);

  useEffect(() => {
    if (!posts.length || firstPostPaintMarkedRef.current) return;
    firstPostPaintMarkedRef.current = true;
    markFeedPerf("first_post_mount", { post_id: posts[0].id.slice(0, 8) });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        markFeedPerf("first_post_paint");
      });
    });
  }, [posts.length > 0 ? posts[0]?.id : null]);

  useEffect(() => {
    if (!userId || !data?.pages.length) return;
    void writeFeedCache(userId, data.pages);
  }, [data?.pages, userId]);

  useEffect(() => {
    if (!userId) return;
    setDeferFeedSecondary(false);
    const timer = setTimeout(() => setDeferFeedSecondary(true), 3_000);
    return () => clearTimeout(timer);
  }, [userId]);

  useEffect(() => {
    if (!userId || !isFeedReady) return;
    const peeked = peekFeedFollowingIds(userId);
    if (!peeked?.length) return;
    const key = ["following-ids", userId] as const;
    if (!queryClient.getQueryData(key)) {
      queryClient.setQueryData(key, peeked);
    }
  }, [isFeedReady, queryClient, userId]);

  useEffect(() => {
    if (!isFeedReady) return;
    const timer = setTimeout(() => setStoriesDeferred(true), 400);
    return () => clearTimeout(timer);
  }, [isFeedReady]);

  useEffect(() => {
    if (!isFeedReady || feedPerfTrackedRef.current || feedLoadStartedRef.current == null) return;
    reportFeedPerfReady(posts.length);
    feedPerfTrackedRef.current = true;
  }, [isFeedReady, posts.length]);

  useEffect(() => {
    if (userId) {
      feedLoadStartedRef.current = performance.now();
      feedPerfTrackedRef.current = false;
    }
  }, [userId]);

  const feedActionsRef = useRef<FeedListItemActions>({
    onPress: () => undefined,
    onInteractPress: () => undefined,
    onAuthorPress: () => undefined,
    onCommentAuthorPress: () => undefined,
    onLike: () => undefined,
    onDoubleTapLike: () => undefined,
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
    onInteractPress: (post: Post, mediaIndex = 0) => {
      openInteraction(post, mediaIndex);
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
    onDoubleTapLike: (post: Post) => {
      if (!post.liked_by_me) toggleLikePost(post.id);
    },
    onComment: (post: Post) => {
      openComments(post);
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
    onMediaPress: (post: Post, uri: string, index: number) => {
      const displayPost = post.shared_post ?? post;
      const mediaItems = normalizePostMediaItems(displayPost.media_urls ?? [], {
        postType: displayPost.post_type,
        thumbnailUrl: displayPost.thumbnail_url,
      });
      const isVideo = mediaItems[index]?.kind === "video";
      const playbackId = buildFeedVideoPlaybackId(displayPost.id, index);
      setFeedVideoFullscreenHandoff(playbackId);
      const videoHandoff = captureFeedVideoForFullscreen(playbackId) ?? undefined;
      setCarouselIndex(post.id, index);
      const immersiveVideo = isVideo ? buildImmersiveVideoContext(post) : undefined;

      let immersiveVideoPlaylist: ImmersiveVideoPlaylistState | undefined;
      if (isVideo && immersiveVideo && usesMobileWebCommentsRoute()) {
        const snapshot = buildFeedVideoPlaylistFromPosts(posts, displayPost.id, index);
        immersiveVideoPlaylist = {
          entries: snapshot.entries,
          initialIndex: snapshot.initialIndex,
          initialHandoff: videoHandoff,
          initialHandoffPlaybackId: playbackId,
          hasMore: Boolean(hasNextPage),
          originMediaIndex: index,
          getPost: (postId) => {
            const cachedPosts =
              queryClient
                .getQueryData<{ pages: { posts: Post[] }[] }>(["feed", userId])
                ?.pages.flatMap((page) => page.posts) ?? posts;
            return cachedPosts.find(
              (candidate) => (candidate.shared_post ?? candidate).id === postId
            );
          },
          buildImmersiveContext: buildImmersiveVideoContext,
          fetchMore: async () => {
            const beforeCount =
              queryClient
                .getQueryData<{ pages: { posts: Post[] }[] }>(["feed", userId])
                ?.pages.flatMap((page) => page.posts).length ?? posts.length;
            await fetchNextPage();
            const updatedPosts =
              queryClient
                .getQueryData<{ pages: { posts: Post[] }[] }>(["feed", userId])
                ?.pages.flatMap((page) => page.posts) ?? [];
            const newPosts = updatedPosts.slice(beforeCount);
            const entries = buildPlaylistEntriesFromPosts(newPosts);
            const feedState = queryClient.getQueryState(["feed", userId]);
            const stillHasMore = Boolean(
              (feedState?.data as { pages: { nextCursor?: string }[] } | undefined)?.pages.at(-1)
                ?.nextCursor
            );
            return { entries, hasMore: stillHasMore };
          },
        };
      }

      if (Platform.OS === "web" && immersiveVideoPlaylist) {
        saveFeedScrollReturnState();
      }

      openGallery(
        displayPost.media_urls ?? [],
        index,
        (finalIndex, context) => {
          const restorePostId = context?.postId ?? displayPost.id;
          const restoreMediaIndex = context?.mediaIndex ?? finalIndex;
          setCarouselIndex(restorePostId, restoreMediaIndex);
          if (Platform.OS === "web") {
            if (immersiveVideoPlaylist) {
              requestFeedScrollReturnRestore();
            } else if (restorePostId) {
              scrollFeedToPost(restorePostId);
            }
          }
        },
        {
          postType: displayPost.post_type,
          thumbnailUrl: displayPost.thumbnail_url,
          videoHandoff,
          immersiveVideo,
          immersiveVideoPlaylist,
          immersiveVideoUserId: userId,
          immersiveVideoAuthorProfile: viewerProfile ?? undefined,
        }
      );
    },
  };

  const feedActions = useMemo<FeedListItemActions>(
    () => ({
      onPress: (post) => feedActionsRef.current.onPress(post),
      onInteractPress: (post, mediaIndex) =>
        feedActionsRef.current.onInteractPress(post, mediaIndex),
      onAuthorPress: (post) => feedActionsRef.current.onAuthorPress(post),
      onCommentAuthorPress: (username) => feedActionsRef.current.onCommentAuthorPress(username),
      onLike: (post) => feedActionsRef.current.onLike(post),
      onDoubleTapLike: (post) => feedActionsRef.current.onDoubleTapLike?.(post),
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

      if (isolatePostCards) {
        return (
          <View style={styles.isolatePlaceholder}>
            <Text style={styles.isolatePlaceholderText}>Post card isolated (bisection)</Text>
          </View>
        );
      }

      markFeedRender("feed:ui:first-post-card", "data", item.post.id.slice(0, 8));
      if (posts[0]?.id === item.post.id) {
        markFeedPerf("first_post_render");
      }

      const mediaActive = !isolateVideo && visiblePostIds.has(item.post.id);
      const onPrimaryMediaReady =
        posts[0]?.id === item.post.id
          ? (source: "image" | "video") => markFirstFeedMediaReady(source)
          : undefined;

      return (
        <SectionErrorBoundary label={`feed-post:${item.post.id.slice(0, 8)}`} compact>
          <AnimatedFeedListItem
            post={item.post}
            userId={userId}
            actions={feedActions}
            interactionActive={activePost?.id === item.post.id}
            inlineComposerEnabled={!commentsVisible}
            mediaActive={mediaActive}
            mediaPageIndex={carouselIndices[item.post.id] ?? 0}
            onMediaPageIndexChange={(pageIndex) => setCarouselIndex(item.post.id, pageIndex)}
            onPrimaryMediaReady={onPrimaryMediaReady}
          />
        </SectionErrorBoundary>
      );
    },
    [
      feedActions,
      userId,
      visiblePostIds,
      carouselIndices,
      setCarouselIndex,
      activePost?.id,
      commentsVisible,
      isolatePostCards,
      isolateVideo,
      posts,
    ]
  );

  const listHeader = useMemo(
    () => (
      <FeedRenderTraceProbe id="feed:ui:list-header">
        <SectionErrorBoundary label="feed-stories-header" compact>
        <FeedHeader
          showHero={false}
          showQuickActions={false}
          showStories={storiesDeferred && !isolateStories}
          stories={stories}
          suggestions={suggestions}
          followingIds={followingIds}
          followLoadingId={
            followMutation.isPending ? (followMutation.variables?.targetUserId ?? null) : null
          }
          onStoryPress={(story) => {
            if (!story.active_stories.length) return;
            const index = stories.findIndex((item) => item.user_id === story.user_id);
            setActiveStoryIndex(index >= 0 ? index : null);
          }}
          onFollowPress={(profileId) => toggleFollow(profileId)}
          onDismissPress={dismissSuggestionRequest}
        />
        </SectionErrorBoundary>
      </FeedRenderTraceProbe>
    ),
    [
      stories,
      storiesDeferred,
      isolateStories,
      suggestions,
      followingIds,
      followMutation.isPending,
      followMutation.variables?.targetUserId,
      toggleFollow,
      dismissSuggestionRequest,
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
  const activeInsightStoryIdResolved =
    activeInsightStoryId ?? activeStory?.active_stories.at(-1)?.id ?? null;

  const { data: storyInsights } = useQuery({
    queryKey: ["story-insights", userId, activeInsightStoryIdResolved],
    queryFn: () => getDedicatedStoryInsights(activeInsightStoryIdResolved!),
    enabled: Boolean(
      activeStory?.is_self &&
        activeInsightStoryIdResolved &&
        (activeStoryIndex !== null || viewersModalVisible || analyticsModalVisible || reactionsModalVisible)
    ),
    staleTime: 30_000,
  });
  markFeedHook("story-insights-query");

  const { data: storyViewers = [], isLoading: storyViewersLoading } = useQuery({
    queryKey: ["story-viewers", userId, activeInsightStoryIdResolved, activeInsightSlideId],
    queryFn: () =>
      getStoryViewers(userId, activeInsightStoryIdResolved!, {
        slideId: activeInsightSlideId,
      }),
    enabled: Boolean(
      viewersModalVisible &&
        activeInsightStoryIdResolved &&
        activeInsightSlideId &&
        activeStory?.is_self
    ),
  });

  const { data: storyReactions = [], isLoading: storyReactionsLoading } = useQuery({
    queryKey: ["story-reactions", userId, activeInsightStoryIdResolved],
    queryFn: () => getStoryReactions(userId, activeInsightStoryIdResolved!),
    enabled: Boolean(reactionsModalVisible && activeInsightStoryIdResolved && activeStory?.is_self),
  });

  const { data: storyAnalytics } = useQuery({
    queryKey: ["story-analytics", activeInsightStoryIdResolved],
    queryFn: () => getDedicatedStoryAnalytics(activeInsightStoryIdResolved!),
    enabled: Boolean(analyticsModalVisible && activeInsightStoryIdResolved && activeStory?.is_self),
    staleTime: 15_000,
  });

  useStoryViewersRealtime(
    userId,
    activeInsightStoryIdResolved,
    Boolean((viewersModalVisible || activeStory?.is_self) && activeStoryIndex !== null)
  );

  const handleListLayout = useCallback(
    (height: number) => {
      listLayoutHeightRef.current = height;
      if (Platform.OS === "web" && height >= 60) {
        hideFrennixBootShell();
        applyPendingFeedScrollReturnIfNeeded();
      }
      markFeedRender(
        "feed:ui:scroll-list-layout",
        "data",
        `listH=${Math.round(height)} contentH=${Math.round(contentHeightRef.current)}`
      );
      reportFeedDebugMetrics(height, contentHeightRef.current);
    },
    [reportFeedDebugMetrics]
  );

  const handleContentSizeChange = useCallback(
    (_width: number, height: number) => {
      contentHeightRef.current = height;
      if (Platform.OS === "web" && height > 0) {
        applyPendingFeedScrollReturnIfNeeded();
      }
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

  if (isolateFeedList) {
    return (
      <StartupMountProbe id="feed-route">
        <TabScreenBoundary label="feed">
          <View
            style={[styles.container, webContainerStyle]}
            nativeID="feed-root-container"
          >
            <View style={styles.isolatePlaceholder}>
              <Text style={styles.isolatePlaceholderText}>Feed list isolated (bisection)</Text>
            </View>
          </View>
        </TabScreenBoundary>
      </StartupMountProbe>
    );
  }

  const refreshControl = isolatePullRefresh ? undefined : (
    <RefreshControl
      refreshing={isRefetching || isStoriesRefetching || isSuggestionsRefetching}
      onRefresh={() => void handleRefresh()}
      {...frennixRefreshControlProps}
    />
  );

  return (
    <StartupMountProbe id="feed-route">
    <TabScreenBoundary label="feed">
    <FeedRenderTraceProbe id="feed:ui:container">
      <FeedBackground
        style={[styles.container, webContainerStyle]}
        nativeID="feed-root-container"
      >
        <FeedVideoPlaybackGate overlaysBlocking={storyVisible || lightboxVisible} />
        <View
          style={styles.feedScrollShell}
          collapsable={false}
          nativeID="feed-scroll-shell"
        >
          <SectionErrorBoundary
            label="feed-scroll-list"
            screen="/(tabs)"
            userId={userId}
            email={session?.user.email ?? undefined}
          >
          {useWebScroll ? (
            <FeedRenderTraceProbe id="feed:ui:scroll-list" detail="WebFeedScrollList">
              <WebFeedScrollList
            scrollRef={webScrollRef}
            nativeID="feed-scroll-list"
            style={styles.feedList}
            contentContainerStyle={listContentStyle}
            scrollEnabled={feedScrollEnabled}
            touchLock={storyVisible}
            data={listRows}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            ListHeaderComponent={listHeader}
            ListEmptyComponent={
              showFeedSkeleton ? (
                <View style={styles.initialSkeletons}>
                  <FeedPostCardSkeleton />
                  <FeedPostCardSkeleton />
                  <FeedPostCardSkeleton />
                  <FeedPostCardSkeleton />
                  <FeedPostCardSkeleton />
                </View>
              ) : (
                <FeedEmptyMotivation suggestions={suggestions} />
              )
            }
            refreshControl={refreshControl}
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
            contentContainerStyle={listContentStyle}
            scrollEnabled={feedScrollEnabled}
            nestedScrollEnabled
            initialNumToRender={8}
            maxToRenderPerBatch={8}
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
            refreshControl={refreshControl}
            onEndReachedThreshold={2}
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
            }}
            ListHeaderComponent={listHeader}
            ListEmptyComponent={
              showFeedSkeleton ? (
                <View style={styles.initialSkeletons}>
                  <FeedPostCardSkeleton />
                  <FeedPostCardSkeleton />
                  <FeedPostCardSkeleton />
                  <FeedPostCardSkeleton />
                  <FeedPostCardSkeleton />
                </View>
              ) : (
                <FeedEmptyMotivation suggestions={suggestions} />
              )
            }
            renderItem={renderItem}
          />
          </FeedRenderTraceProbe>
        )}
          </SectionErrorBoundary>
      </View>
      {showBanner && !storyVisible ? (
        <NewPostsBanner count={newPostCount} onPress={() => void handleNewPostsBannerPress()} />
      ) : null}
      {showLocationBanner && !storyVisible ? (
        <LocationFeedBanner
          visible
          onEnable={() => pushScreen("/privacy-settings")}
          onDismiss={() => void dismissLocationBanner()}
        />
      ) : null}
      <FeedRenderTraceProbe id="feed:ui:post-action-sheets">{postActionSheets}</FeedRenderTraceProbe>
      <FeedRenderTraceProbe id="feed:ui:post-interaction-sheet">{interactionSheet}</FeedRenderTraceProbe>
      <FeedRenderTraceProbe id="feed:ui:post-comments-sheet">{commentsSheet}</FeedRenderTraceProbe>
      <FeedRenderTraceProbe id="feed:ui:share-sheet">{shareSheet}</FeedRenderTraceProbe>
      <FeedRenderTraceProbe id="feed:ui:lightbox">{lightbox}</FeedRenderTraceProbe>
      <FeedRenderTraceProbe id="feed:ui:story-viewer">
      {activeStoryIndex !== null ? (
      <FeedStoryViewer
        stories={stories}
        visible
        initialStoryIndex={activeStoryIndex}
        onClose={() => setActiveStoryIndex(null)}
        onViewProfile={(username) => {
          setActiveStoryIndex(null);
          pushScreen(`/user/${username}`);
        }}
        onViewProfileFromStory={(storyUserId, username) => {
          const storyId =
            stories.find((item) => item.user_id === storyUserId)?.active_stories.at(-1)?.id ?? null;
          if (storyId) {
            void trackStoryProfileVisit(userId, storyUserId, storyId, { isDedicated: true }).catch(
              () => undefined
            );
          }
          setActiveStoryIndex(null);
          pushScreen(`/user/${username}`);
        }}
        onShareWorkout={() => {
          setActiveStoryIndex(null);
          openCreateStory();
        }}
        onMarkViewed={markStoryViewedOptimistic}
        onReact={handleStoryReact}
        onChallenge={handleStoryChallenge}
        onReply={handleStoryReply}
        onJoinChallenge={handleJoinStoryChallenge}
        onInviteToEvent={handleStoryEventInvite}
        onDiscoverTag={handleDiscoverStoryTag}
        onDiscoverLocation={handleDiscoverStoryLocation}
        onOpenViewers={(slideId) => {
          setActiveInsightStoryId(activeStory?.active_stories.at(-1)?.id ?? null);
          setActiveInsightSlideId(slideId);
          setViewersModalVisible(true);
        }}
        onOpenAnalytics={(slideId) => {
          setActiveInsightStoryId(activeStory?.active_stories.at(-1)?.id ?? null);
          setActiveInsightSlideId(slideId);
          setAnalyticsModalVisible(true);
        }}
        onActiveSlideChange={(_storyId, slideId) => {
          setActiveInsightSlideId(slideId);
        }}
        onOpenReactions={() => {
          setActiveInsightStoryId(activeStory?.active_stories.at(-1)?.id ?? null);
          setReactionsModalVisible(true);
        }}
        onFollow={handleStoryFollow}
        onInviteToTrain={handleStoryInviteToTrain}
        onMarkCommitmentComplete={
          activeStory?.is_self
            ? () => {
                const storyId = activeStory.active_stories.at(-1)?.id;
                if (storyId) void handleMarkStoryCommitmentComplete(storyId);
              }
            : undefined
        }
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
      ) : null}
      </FeedRenderTraceProbe>
      {viewersModalVisible ? (
      <StoryViewersModal
        visible
        viewers={storyViewers}
        loading={storyViewersLoading}
        onClose={() => setViewersModalVisible(false)}
        onViewerPress={(viewer) => {
          setViewersModalVisible(false);
          pushScreen(`/user/${viewer.profile.username}`);
        }}
      />
      ) : null}
      {analyticsModalVisible ? (
      <StoryAnalyticsModal
        visible
        analytics={storyAnalytics ?? storyInsights ?? null}
        onClose={() => setAnalyticsModalVisible(false)}
        onOpenViewers={() => {
          setAnalyticsModalVisible(false);
          if (activeInsightSlideId) {
            setViewersModalVisible(true);
          }
        }}
        onOpenReactions={() => {
          setAnalyticsModalVisible(false);
          setReactionsModalVisible(true);
        }}
      />
      ) : null}
      {reactionsModalVisible ? (
      <StoryReactionsModal
        visible
        reactions={storyReactions}
        loading={storyReactionsLoading}
        onClose={() => setReactionsModalVisible(false)}
      />
      ) : null}
      {feedDebugEnabled ? (
        <FeedScrollDebugOverlay
          snapshot={feedDebugSnapshot}
          collapsed={feedDebugCollapsed}
          onToggleCollapsed={() => setFeedDebugCollapsed((value) => !value)}
        />
      ) : null}
      <UndoSnackbar
        visible={!!pendingDismiss}
        message="Suggestion removed"
        onUndo={undoDismiss}
      />
      </FeedBackground>
    </FeedRenderTraceProbe>
    </TabScreenBoundary>
    </StartupMountProbe>
  );
}

const styles = StyleSheet.create({
  container: { ...flexFill, ...webTabSceneShell, backgroundColor: colors.backgroundFeed },
  feedScrollShell: { ...flexFill, backgroundColor: "transparent" },
  feedList: { ...flexFill, ...webScrollSurface },
  list: {
    flexGrow: 1,
    paddingTop: 0,
  },
  initialSkeletons: { gap: spacing.md },
  isolatePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  isolatePlaceholderText: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: "center",
  },
});
