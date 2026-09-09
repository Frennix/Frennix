import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useIsFocused } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { getErrorMessage, getReelsFeed } from "@frennix/api";
import { type Post } from "@frennix/types";
import { ReelsFeedItem } from "@/components/ReelsFeedItem";
import { TabScreenBoundary } from "@/components/TabScreenBoundary";
import {
  buildFeedVideoPlaylistFromPosts,
  buildPlaylistEntriesFromPosts,
  extractVideoMediaIndex,
  postHasFeedVideo,
} from "@/lib/immersive-video-playlist";
import type { ImmersiveVideoPlaylistState } from "@/lib/immersive-video-playlist-state";
import { usesMobileWebCommentsRoute } from "@/lib/mobile-web-comments-route";
import { openCreatePost } from "@/lib/press-utils";
import {
  frennixRefreshControlProps,
  tabScreenContainer,
  tabScreenScrollSurface,
} from "@/lib/screen-shell";
import { handleTabRetap, scrollFlatListToTop } from "@/lib/tab-scroll-registry";
import { useBuildImmersiveVideoContext } from "@/lib/useBuildImmersiveVideoContext";
import { useGuardedRefresh } from "@/lib/useGuardedRefresh";
import { useImageLightbox } from "@/lib/useImageLightbox";
import { useScrollAtTop } from "@/lib/useScrollAtTop";
import { useTabScrollRegistration } from "@/lib/useTabScrollRegistration";
import { useAuth } from "@/providers/AuthProvider";
import { EmptyState, QueryErrorState, colors, spacing } from "@frennix/ui";

const REELS_STALE_MS = 60_000;

function ReelsScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const isFocused = useIsFocused();
  const queryClient = useQueryClient();
  const listRef = useRef<FlatList<Post>>(null);
  const openedThisVisitRef = useRef(false);
  const { onScroll, isAtTop } = useScrollAtTop();
  const { openGallery, closeGallery, lightbox, lightboxVisible } = useImageLightbox();
  const { buildImmersiveContext, shareSheet, postActionSheets } =
    useBuildImmersiveVideoContext(userId, {
      onDeleted: () => closeGallery(0),
    });

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending,
    isRefetching,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["reels", userId],
    queryFn: ({ pageParam }) => getReelsFeed(userId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(userId) && isFocused,
    staleTime: REELS_STALE_MS,
  });

  const posts = useMemo(
    () => (data?.pages.flatMap((page) => page.posts) ?? []).filter(postHasFeedVideo),
    [data]
  );

  const openReel = useCallback(
    (post: Post) => {
      const displayPost = post.shared_post ?? post;
      const video = extractVideoMediaIndex(post, 0);
      if (!video) return;

      const immersiveVideo = buildImmersiveContext(post);
      let immersiveVideoPlaylist: ImmersiveVideoPlaylistState | undefined;
      if (immersiveVideo && usesMobileWebCommentsRoute()) {
        const snapshot = buildFeedVideoPlaylistFromPosts(posts, displayPost.id, video.mediaIndex);
        immersiveVideoPlaylist = {
          entries: snapshot.entries,
          initialIndex: snapshot.initialIndex,
          hasMore: Boolean(hasNextPage),
          originMediaIndex: video.mediaIndex,
          caughtUpLabel: "You're caught up on Reels",
          getPost: (postId) => {
            const cachedPosts =
              queryClient
                .getQueryData<{ pages: { posts: Post[] }[] }>(["reels", userId])
                ?.pages.flatMap((page) => page.posts) ?? posts;
            return cachedPosts.find(
              (candidate) => (candidate.shared_post ?? candidate).id === postId
            );
          },
          buildImmersiveContext,
          fetchMore: async () => {
            const beforeCount =
              queryClient
                .getQueryData<{ pages: { posts: Post[] }[] }>(["reels", userId])
                ?.pages.flatMap((page) => page.posts).length ?? posts.length;
            await fetchNextPage();
            const updatedPosts =
              queryClient
                .getQueryData<{ pages: { posts: Post[] }[] }>(["reels", userId])
                ?.pages.flatMap((page) => page.posts) ?? [];
            const newPosts = updatedPosts.slice(beforeCount);
            return {
              entries: buildPlaylistEntriesFromPosts(newPosts),
              hasMore: Boolean(
                (
                  queryClient.getQueryState(["reels", userId])?.data as
                    | { pages: { nextCursor?: string }[] }
                    | undefined
                )?.pages.at(-1)?.nextCursor
              ),
            };
          },
        };
      }

      openGallery(displayPost.media_urls ?? [], video.mediaIndex, undefined, {
        postType: displayPost.post_type,
        thumbnailUrl: displayPost.thumbnail_url,
        immersiveVideo,
        immersiveVideoPlaylist,
        immersiveVideoUserId: userId,
        immersiveVideoAuthorProfile: post.author,
      });
    },
    [
      buildImmersiveContext,
      fetchNextPage,
      hasNextPage,
      openGallery,
      posts,
      queryClient,
      userId,
    ]
  );

  const scrollToTop = useCallback(() => {
    handleTabRetap({
      isAtTop,
      scrollToTop: () => scrollFlatListToTop(listRef.current),
      refresh: () => {
        void refetch();
      },
    });
  }, [isAtTop, refetch]);

  useTabScrollRegistration("reels", scrollToTop);

  const openReelRef = useRef(openReel);
  openReelRef.current = openReel;

  useEffect(() => {
    if (!isFocused) {
      openedThisVisitRef.current = false;
      if (lightboxVisible) closeGallery(0);
      return;
    }

    const firstReel = posts[0];
    if (!firstReel || openedThisVisitRef.current || lightboxVisible) return;
    openedThisVisitRef.current = true;
    openReelRef.current(firstReel);
  }, [closeGallery, isFocused, lightboxVisible, posts]);

  const onRefresh = useGuardedRefresh(() => refetch(), {
    errorTitle: "Could not refresh Reels",
    haptic: true,
  });

  const renderItem = useCallback(
    ({ item }: { item: Post }) => (
      <ReelsFeedItem post={item} onPress={() => openReel(item)} />
    ),
    [openReel]
  );

  const listFooter = useMemo(() => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator color={colors.accent} size="small" />
      </View>
    );
  }, [isFetchingNextPage]);

  const emptyState = error ? (
    <QueryErrorState
      title="Could not load Reels"
      message={getErrorMessage(error, "Check your connection and try again.")}
      onRetry={() => {
        void refetch();
      }}
    />
  ) : isPending ? (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.accent} size="large" accessibilityLabel="Loading Reels" />
    </View>
  ) : (
    <EmptyState
      title="Reels are fitness journeys shared by the Frennix community."
      description="Share yours when you are ready."
      actionLabel="Share Your Journey"
      onAction={() => openCreatePost({ intent: "reel" })}
    />
  );

  return (
    <View style={styles.root}>
      <FlatList
        ref={listRef}
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={posts.length ? styles.list : styles.emptyList}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isFetchingNextPage}
            onRefresh={() => void onRefresh()}
            {...frennixRefreshControlProps}
          />
        }
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            void fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.6}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews={Platform.OS !== "web"}
        ListEmptyComponent={emptyState}
        ListFooterComponent={listFooter}
        accessibilityLabel="Frennix Reels"
      />
      {lightbox}
      {shareSheet}
      {postActionSheets}
    </View>
  );
}

export default function ReelsTab() {
  return (
    <TabScreenBoundary label="reels">
      <ReelsScreen />
    </TabScreenBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    ...tabScreenContainer,
    backgroundColor: colors.backgroundFeed,
  },
  list: {
    ...tabScreenScrollSurface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  emptyList: {
    ...tabScreenScrollSurface,
    flexGrow: 1,
  },
  separator: {
    height: spacing.lg,
  },
  loading: {
    flex: 1,
    minHeight: 280,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
});
