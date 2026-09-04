import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { getFeed } from "@frennix/api";
import { normalizePostMediaItems, type Post } from "@frennix/types";
import { ImmersiveVideoOverlayShell } from "@/components/ImmersiveVideoOverlayShell";
import {
  buildFeedVideoPlaylistFromPosts,
  buildPlaylistEntriesFromPosts,
} from "@/lib/immersive-video-playlist";
import type { ImmersiveVideoPlaylistState } from "@/lib/immersive-video-playlist-state";
import { usesMobileWebCommentsRoute } from "@/lib/mobile-web-comments-route";
import { useBuildImmersiveVideoContext } from "@/lib/useBuildImmersiveVideoContext";
import { usesMobileWebVideoRoute } from "@/lib/mobile-web-video-route";
import { flexFill, webTabSceneShell } from "@/lib/flex-layout";
import type { FeedVideoFullscreenHandoff } from "@frennix/ui";
import { colors } from "@frennix/ui";

type PostVideoScreenProps = {
  post: Post;
  mediaIndex: number;
  resumeHandoff?: FeedVideoFullscreenHandoff;
  userId: string;
  authorProfile?: Post["author"];
  onBack: () => void;
};

export function PostVideoScreen({
  post,
  mediaIndex,
  resumeHandoff,
  userId,
  authorProfile,
  onBack,
}: PostVideoScreenProps) {
  const { width, height } = useWindowDimensions();
  const queryClient = useQueryClient();
  const { buildImmersiveContext, shareSheet, postActionSheets } =
    useBuildImmersiveVideoContext(userId);

  const displayPost = post.shared_post ?? post;
  const mediaItems = normalizePostMediaItems(displayPost.media_urls ?? [], {
    postType: displayPost.post_type,
    thumbnailUrl: displayPost.thumbnail_url,
  });
  const item = mediaItems[mediaIndex];

  const playlistEnabled =
    Platform.OS === "web" &&
    usesMobileWebVideoRoute() &&
    usesMobileWebCommentsRoute();

  const { fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ["feed", userId],
    queryFn: ({ pageParam }) => getFeed(userId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: playlistEnabled && !!userId,
    staleTime: 60_000,
  });

  const feedPosts = useMemo(() => {
    const cached =
      queryClient
        .getQueryData<{ pages: { posts: Post[] }[] }>(["feed", userId])
        ?.pages.flatMap((page) => page.posts) ?? [];
    if (cached.some((candidate) => (candidate.shared_post ?? candidate).id === displayPost.id)) {
      return cached;
    }
    return [post, ...cached];
  }, [displayPost.id, post, queryClient, userId]);

  const playlist = useMemo((): ImmersiveVideoPlaylistState | null => {
    if (!item || item.kind !== "video") return null;
    const snapshot = buildFeedVideoPlaylistFromPosts(feedPosts, displayPost.id, mediaIndex);
    if (!snapshot.entries.length) return null;
    return {
      entries: snapshot.entries,
      initialIndex: snapshot.initialIndex,
      initialHandoff: resumeHandoff,
      initialHandoffPlaybackId: resumeHandoff?.playbackId,
      hasMore: Boolean(hasNextPage),
      originMediaIndex: mediaIndex,
      getPost: (postId) =>
        feedPosts.find((candidate) => (candidate.shared_post ?? candidate).id === postId),
      buildImmersiveContext,
      fetchMore: async () => {
        const beforeCount = feedPosts.length;
        await fetchNextPage();
        const updatedPosts =
          queryClient
            .getQueryData<{ pages: { posts: Post[] }[] }>(["feed", userId])
            ?.pages.flatMap((page) => page.posts) ?? feedPosts;
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
  }, [
    buildImmersiveContext,
    displayPost.id,
    feedPosts,
    fetchNextPage,
    hasNextPage,
    item,
    mediaIndex,
    queryClient,
    resumeHandoff,
    userId,
  ]);

  if (!item || item.kind !== "video" || !playlist) {
    return <View style={[styles.unavailableRoot, webTabSceneShell]} />;
  }

  return (
    <View style={[styles.root, webTabSceneShell]}>
      <ImmersiveVideoOverlayShell
        playlist={playlist}
        userId={userId}
        authorProfile={authorProfile}
        stageWidth={width}
        stageHeight={height}
        onClose={onBack}
        routePlayback
      />
      {shareSheet}
      {postActionSheets}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...flexFill,
    backgroundColor: colors.black,
    overflow: "hidden",
  },
  unavailableRoot: {
    ...flexFill,
    backgroundColor: colors.background,
  },
});
