/**
 * Web-only feed rebuild probe — replace numbered rows with real feed pieces step by step.
 *
 * Bump FEED_REBUILD_STEP locally (expo start --web). Do not deploy until a step fails
 * and the failing component/hook is fixed.
 *
 * Step 0 — ScrollView + 20 numbered rows (baseline — confirmed working)
 * Step 1 — FeedHeader only (no stories row)
 * Step 2 — + Stories (FeedStoriesRow inside FeedHeader)
 * Step 3 — + Post cards (WebFeedScrollList + AnimatedFeedListItem)
 * Step 4 — + Overlays/actions (shareSheet, lightbox, postActionSheets, FeedStoryViewer)
 * Step 5 — + Remaining production hooks (infinite scroll, likes, banner, tab scroll, debug)
 */
import type { Post } from "@frennix/types";
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getFeed, getFeedStories, getSuggestedAthletes } from "@frennix/api";
import { AnimatedFeedListItem } from "@/components/AnimatedFeedListItem";
import { FeedHeader } from "@/components/FeedHeader";
import { FeedScrollDebugOverlay } from "@/components/FeedScrollDebugOverlay";
import { FeedStoryViewer } from "@/components/FeedStoryViewer";
import { NewPostsBanner } from "@/components/NewPostsBanner";
import { WebFeedScrollList } from "@/components/WebFeedScrollList";
import { buildFeedListRows, type FeedListRow } from "@/lib/feed-list-rows";
import { flexFill, webVerticalScrollStyle } from "@/lib/flex-layout";
import { useFeedInfiniteScroll } from "@/lib/useFeedInfiniteScroll";
import { useFeedLike } from "@/lib/useFeedLike";
import { useFeedNewPostsBanner } from "@/lib/useFeedNewPostsBanner";
import { useFeedScrollDebug } from "@/lib/useFeedScrollDebug";
import { useGuardedRefresh } from "@/lib/useGuardedRefresh";
import { useImageLightbox } from "@/lib/useImageLightbox";
import { usePostActions } from "@/lib/usePostActions";
import { usePostReaction } from "@/lib/usePostReaction";
import { useSavePost } from "@/lib/useSavePost";
import { useScrollAtTop } from "@/lib/useScrollAtTop";
import { useSharePost } from "@/lib/useSharePost";
import { handleTabRetap, scrollScrollViewToTop } from "@/lib/tab-scroll-registry";
import { useTabScrollRegistration } from "@/lib/useTabScrollRegistration";
import { useAuth } from "@/providers/AuthProvider";
import { colors, spacing } from "@frennix/ui";

/** ← Change locally: 0 → 1 → 2 → 3 → 4 → 5 */
export const FEED_REBUILD_STEP = 1;

const ROW_COUNT = 20;

export const STEP_LABELS = [
  "baseline numbered rows",
  "FeedHeader only",
  "+ stories",
  "+ post cards",
  "+ overlays/actions",
  "+ remaining hooks",
] as const;

function StepBanner({ step }: { step: number }) {
  return (
    <>
      <Text style={styles.heading}>Feed is rendering</Text>
      <Text style={styles.stepLabel}>
        rebuild step {step}: {STEP_LABELS[step] ?? "unknown"}
      </Text>
    </>
  );
}

function NumberedRows() {
  return (
    <>
      {Array.from({ length: ROW_COUNT }, (_, index) => (
        <View key={index} style={styles.row}>
          <Text style={styles.rowText}>Row {index + 1}</Text>
        </View>
      ))}
    </>
  );
}

const noopActions = {
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
};

/** Step 4 — overlay hooks isolated in a child so steps 0–3 stay clean. */
function FeedRebuildOverlays({
  userId,
  stories,
}: {
  userId: string;
  stories: Parameters<typeof FeedStoryViewer>[0]["stories"];
}) {
  const [activeStoryIndex] = useState<number | null>(null);
  const { shareSheet } = useSharePost(userId);
  const { postActionSheets } = usePostActions({ userId });
  const { lightbox } = useImageLightbox();

  return (
    <>
      {postActionSheets}
      {shareSheet}
      {lightbox}
      <FeedStoryViewer
        stories={stories}
        visible={activeStoryIndex !== null}
        initialStoryIndex={0}
        onClose={() => undefined}
        onViewProfile={() => undefined}
        onViewProfileFromStory={() => undefined}
        onShareWorkout={() => undefined}
        onMarkViewed={() => undefined}
        onReact={async () => undefined}
        onChallenge={async () => undefined}
        onReply={async () => undefined}
        onFollow={() => undefined}
        onInviteToTrain={async () => undefined}
        storyInsights={null}
        followLoading={false}
        inviteLoading={false}
      />
    </>
  );
}

/** Step 5 — production hooks that are not in steps 1–4. */
function FeedRebuildAdvancedHooks({
  userId,
  webScrollRef,
  listRows,
  posts,
  isFeedReady,
  feedLoading,
  isRefetching,
  refetch,
  listHeader,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: {
  userId: string;
  webScrollRef: React.RefObject<ScrollView | null>;
  listRows: FeedListRow[];
  posts: Post[];
  isFeedReady: boolean;
  feedLoading: boolean;
  isRefetching: boolean;
  refetch: () => Promise<unknown>;
  listHeader: ReactNode;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
}) {
  const { height: viewportHeight } = useWindowDimensions();
  const pageCount = posts.length > 0 ? 1 : 0;
  const { onScroll, onScrollEnd, isAtTop } = useScrollAtTop();
  const [feedAtTop, setFeedAtTop] = useState(true);
  const [feedDebugCollapsed, setFeedDebugCollapsed] = useState(false);

  const { toggleLikePost } = useFeedLike(userId);
  const { toggleSavePost } = useSavePost(userId);
  const postReaction = usePostReaction(userId);
  const { openShare, shareSheet, shareVisible } = useSharePost(userId);
  const { openPostActions, postActionSheets } = usePostActions({
    userId,
    onShareInApp: (post) => openShare(post.shared_post ?? post),
  });
  const { openGallery, lightbox, lightboxVisible } = useImageLightbox();

  const {
    listRows: infiniteListRows,
    handleScroll: handleFeedScroll,
  } = useFeedInfiniteScroll({
    posts,
    pageCount,
    isFeedReady,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage: () => void fetchNextPage(),
    onScrollBase: onScroll,
  });

  const {
    enabled: feedDebugEnabled,
    snapshot: feedDebugSnapshot,
    reportMetrics: reportFeedDebugMetrics,
    reportScroll: reportFeedDebugScroll,
  } = useFeedScrollDebug({
    listRef: webScrollRef,
    scrollEnabled: true,
    storyVisible: false,
    shareSheetVisible: shareVisible,
    lightboxVisible,
    viewportHeight,
  });

  const handleScroll = useCallback(
    (event: Parameters<typeof handleFeedScroll>[0]) => {
      handleFeedScroll(event);
      reportFeedDebugScroll(event.nativeEvent.contentOffset.y);
      const atTop = event.nativeEvent.contentOffset.y <= 8;
      setFeedAtTop((prev) => (prev === atTop ? prev : atTop));
    },
    [handleFeedScroll, reportFeedDebugScroll]
  );

  const handleRefresh = useGuardedRefresh(async () => refetch(), {
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

  const scrollFeedToTop = useCallback(() => {
    scrollScrollViewToTop(webScrollRef.current);
  }, [webScrollRef]);

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
      [handleRefresh, isAtTop, scrollFeedToTop]
    )
  );

  const rows = infiniteListRows.length > 0 ? infiniteListRows : listRows;

  const renderItem = useCallback(
    ({ item }: { item: FeedListRow }) => {
      if (item.kind === "skeleton") {
        return (
          <View style={styles.row}>
            <Text style={styles.rowText}>Loading…</Text>
          </View>
        );
      }

      return (
        <AnimatedFeedListItem
          post={item.post}
          userId={userId}
          actions={{
            onPress: noopActions.onPress,
            onAuthorPress: noopActions.onAuthorPress,
            onCommentAuthorPress: noopActions.onCommentAuthorPress,
            onLike: () => toggleLikePost(item.post.id),
            onComment: noopActions.onComment,
            onShare: () => openShare(item.post.shared_post ?? item.post),
            onSave: () => toggleSavePost(item.post.id, !!item.post.saved_by_me),
            onReaction: (_post, emoji) =>
              postReaction.mutate({
                postId: item.post.id,
                emoji,
                currentEmoji: item.post.my_reaction,
              }),
            onModerationPress: (post) => openPostActions(post),
            onOwnerActionsPress: (post) => openPostActions(post),
            onMediaPress: (post, _uri, index) =>
              openGallery(post.shared_post?.media_urls ?? post.media_urls ?? [], index),
          }}
          mediaActive
          mediaPageIndex={0}
          onMediaPageIndexChange={() => undefined}
        />
      );
    },
    [
      openGallery,
      openPostActions,
      openShare,
      postReaction,
      toggleLikePost,
      toggleSavePost,
      userId,
    ]
  );

  return (
    <>
      <View style={styles.container}>
        <View style={styles.feedScrollShell} collapsable={false}>
          <WebFeedScrollList
            scrollRef={webScrollRef}
            style={styles.feedList}
            contentContainerStyle={styles.listContent}
            scrollEnabled
            data={rows}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            ListHeaderComponent={listHeader}
            ListEmptyComponent={
              !feedLoading ? (
                <View style={styles.row}>
                  <Text style={styles.rowText}>No posts from API</Text>
                </View>
              ) : null
            }
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={() => void handleRefresh()}
                tintColor={colors.accent}
                colors={[colors.accent]}
              />
            }
            onScroll={handleScroll}
            onScrollEndDrag={onScrollEnd}
            onMomentumScrollEnd={onScrollEnd}
            onLayout={(height) => reportFeedDebugMetrics(height, 0)}
          />
        </View>
      </View>
      {showBanner ? (
        <NewPostsBanner
          count={newPostCount}
          onPress={() => {
            clearBanner();
            void handleRefresh();
            scrollFeedToTop();
          }}
        />
      ) : null}
      {postActionSheets}
      {shareSheet}
      {lightbox}
      {feedDebugEnabled ? (
        <FeedScrollDebugOverlay
          snapshot={feedDebugSnapshot}
          collapsed={feedDebugCollapsed}
          onToggleCollapsed={() => setFeedDebugCollapsed((value) => !value)}
        />
      ) : null}
    </>
  );
}

export default function FeedRebuildProbe() {
  const step = FEED_REBUILD_STEP;
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const scrollRef = useRef<ScrollView>(null);
  const webScrollRef = useRef<ScrollView>(null);

  const { data: stories = [] } = useQuery({
    queryKey: ["feed-stories", userId],
    queryFn: () => getFeedStories(userId),
    enabled: step >= 2 && !!userId,
    staleTime: 60_000,
  });

  const { data: suggestions = [] } = useQuery({
    queryKey: ["suggested-athletes", userId],
    queryFn: () => getSuggestedAthletes(userId, 10),
    enabled: step >= 1 && !!userId,
    staleTime: 120_000,
  });

  const {
    data: feedPages,
    isLoading: feedLoading,
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
    enabled: step >= 3 && !!userId,
    staleTime: 60_000,
  });

  const posts = useMemo(
    () => feedPages?.pages.flatMap((page) => page.posts) ?? [],
    [feedPages?.pages]
  );

  const listRows = useMemo(
    () =>
      step >= 3
        ? buildFeedListRows(posts, {
            hasNextPage: !!hasNextPage,
            showTrailingSkeletons: !!hasNextPage,
          })
        : [],
    [hasNextPage, posts, step]
  );

  const renderPost = useCallback(
    ({ item }: { item: FeedListRow }) => {
      if (item.kind === "skeleton") {
        return (
          <View style={styles.row}>
            <Text style={styles.rowText}>Loading…</Text>
          </View>
        );
      }

      return (
        <AnimatedFeedListItem
          post={item.post}
          userId={userId}
          actions={noopActions}
          mediaActive
          mediaPageIndex={0}
          onMediaPageIndexChange={() => undefined}
        />
      );
    },
    [userId]
  );

  const feedHeader = (
    <FeedHeader
      stories={stories}
      suggestions={suggestions}
      followingIds={[]}
      showTopRow
      showSuggestions={step >= 1}
      showStories={step >= 2}
      showQuickActions={step >= 1}
      onStoryPress={() => undefined}
      onFollowPress={() => undefined}
    />
  );

  const listHeader = (
    <>
      <StepBanner step={step} />
      {step >= 1 ? feedHeader : null}
      {step === 0 ? <NumberedRows /> : null}
    </>
  );

  if (step >= 5) {
    return (
      <FeedRebuildAdvancedHooks
        userId={userId}
        webScrollRef={webScrollRef}
        listRows={listRows}
        posts={posts}
        isFeedReady={isFeedReady}
        feedLoading={feedLoading}
        isRefetching={isRefetching}
        refetch={refetch}
        listHeader={listHeader}
        hasNextPage={!!hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={fetchNextPage}
      />
    );
  }

  const feedBody = (
    <View style={styles.container}>
      <View style={styles.feedScrollShell} collapsable={false}>
        {step <= 2 ? (
          <ScrollView
            ref={scrollRef}
            style={styles.feedList}
            contentContainerStyle={styles.listContent}
            nestedScrollEnabled
          >
            {listHeader}
          </ScrollView>
        ) : (
          <WebFeedScrollList
            scrollRef={webScrollRef}
            style={styles.feedList}
            contentContainerStyle={styles.listContent}
            scrollEnabled
            data={listRows}
            keyExtractor={(item) => item.id}
            renderItem={renderPost}
            ListHeaderComponent={listHeader}
            ListEmptyComponent={
              !feedLoading ? (
                <View style={styles.row}>
                  <Text style={styles.rowText}>No posts from API</Text>
                </View>
              ) : null
            }
            onScroll={() => undefined}
          />
        )}
      </View>
    </View>
  );

  if (step >= 4) {
    return (
      <>
        {feedBody}
        <FeedRebuildOverlays userId={userId} stories={stories} />
      </>
    );
  }

  return feedBody;
}

/** Matches app/(tabs)/index.tsx feed shell styles */
const styles = StyleSheet.create({
  container: { ...flexFill, backgroundColor: colors.background },
  feedScrollShell: { ...flexFill },
  feedList: { ...flexFill, ...webVerticalScrollStyle },
  listContent: { flexGrow: 1, paddingBottom: spacing.xl },
  heading: {
    color: "#ffea00",
    fontSize: 22,
    fontWeight: "900",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  stepLabel: {
    color: colors.textMuted,
    fontSize: 12,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  row: {
    minHeight: 56,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 8,
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#333333",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  rowText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
});
