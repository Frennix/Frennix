import { useCallback, useMemo, useState } from "react";
import { Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { getFeed } from "@frennix/api";
import { normalizePostMediaItems, type Post } from "@frennix/types";
import { ImmersiveVideoPlaylistViewer } from "@/components/ImmersiveVideoPlaylistViewer";
import { ImmersiveVideoViewer } from "@/components/ImmersiveVideoViewer";
import { PostCommentsSheet } from "@/components/PostCommentsSheet";
import type { ImmersiveVideoGalleryContext } from "@/lib/immersive-video-gallery";
import {
  buildFeedVideoPlaylistFromPosts,
  buildPlaylistEntriesFromPosts,
} from "@/lib/immersive-video-playlist";
import { usesMobileWebCommentsRoute } from "@/lib/mobile-web-comments-route";
import { usesMobileWebVideoRoute } from "@/lib/mobile-web-video-route";
import { flexFill, webTabSceneShell } from "@/lib/flex-layout";
import type { FeedVideoFullscreenHandoff } from "@frennix/ui";
import { colors } from "@frennix/ui";

type PostVideoScreenProps = {
  post: Post;
  mediaIndex: number;
  resumeHandoff?: FeedVideoFullscreenHandoff;
  postActions: ImmersiveVideoGalleryContext["postActions"];
  buildImmersiveContext: (post: Post) => ImmersiveVideoGalleryContext | undefined;
  userId: string;
  authorProfile?: Post["author"];
  onBack: () => void;
};

export function PostVideoScreen({
  post,
  mediaIndex,
  resumeHandoff,
  postActions,
  buildImmersiveContext,
  userId,
  authorProfile,
  onBack,
}: PostVideoScreenProps) {
  const { width, height } = useWindowDimensions();
  const queryClient = useQueryClient();
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [commentDraft, setCommentDraft] = useState<string | undefined>();

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

  const { data: feedData, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ["feed", userId],
    queryFn: ({ pageParam }) => getFeed(userId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: playlistEnabled && !!userId,
    staleTime: 60_000,
  });

  const feedPosts = feedData?.pages.flatMap((page) => page.posts) ?? [];
  const postsForPlaylist = useMemo(() => {
    if (!playlistEnabled) return [post];
    if (feedPosts.some((candidate) => (candidate.shared_post ?? candidate).id === displayPost.id)) {
      return feedPosts;
    }
    return [post, ...feedPosts];
  }, [displayPost.id, feedPosts, playlistEnabled, post]);

  const playlistSnapshot = useMemo(
    () => buildFeedVideoPlaylistFromPosts(postsForPlaylist, displayPost.id, mediaIndex),
    [displayPost.id, mediaIndex, postsForPlaylist]
  );

  const getPost = useCallback(
    (postId: string) =>
      postsForPlaylist.find((candidate) => (candidate.shared_post ?? candidate).id === postId),
    [postsForPlaylist]
  );

  const closeComments = useCallback(() => {
    setCommentsVisible(false);
    setCommentDraft(undefined);
  }, []);

  const openCommentsOverlay = useCallback((draft?: string) => {
    setCommentDraft(draft);
    setCommentsVisible(true);
  }, []);

  const wrappedBuildImmersiveContext = useCallback(
    (targetPost: Post) => {
      const context = buildImmersiveContext(targetPost);
      if (!context) return undefined;
      return {
        ...context,
        postActions: {
          ...context.postActions,
          onComment: (
            playback: Parameters<typeof context.postActions.onComment>[0],
            draft?: string
          ) => {
            if (Platform.OS === "web" && usesMobileWebCommentsRoute()) {
              openCommentsOverlay(draft);
              return;
            }
            context.postActions.onComment(playback, draft);
          },
        },
      };
    },
    [buildImmersiveContext, openCommentsOverlay]
  );

  const videoPostActions = useMemo(
    () => ({
      ...postActions,
      onComment: (_playback: Parameters<typeof postActions.onComment>[0], draft?: string) => {
        if (Platform.OS === "web" && usesMobileWebCommentsRoute()) {
          openCommentsOverlay(draft);
          return;
        }
        postActions.onComment(_playback, draft);
      },
    }),
    [openCommentsOverlay, postActions]
  );

  if (!item || item.kind !== "video") {
    return <View style={[styles.unavailableRoot, webTabSceneShell]} />;
  }

  if (playlistEnabled && playlistSnapshot.entries.length > 0) {
    return (
      <View style={[styles.root, webTabSceneShell]}>
        <ImmersiveVideoPlaylistViewer
          entries={playlistSnapshot.entries}
          initialIndex={playlistSnapshot.initialIndex}
          initialHandoff={resumeHandoff}
          initialHandoffPlaybackId={resumeHandoff?.playbackId}
          stageWidth={width}
          stageHeight={height}
          getPost={getPost}
          buildImmersiveContext={wrappedBuildImmersiveContext}
          hasMore={Boolean(hasNextPage)}
          fetchMore={async () => {
            const beforeCount =
              queryClient
                .getQueryData<{ pages: { posts: Post[] }[] }>(["feed", userId])
                ?.pages.flatMap((page) => page.posts).length ?? feedPosts.length;
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
          }}
          onClose={onBack}
        />
        {Platform.OS === "web" && usesMobileWebCommentsRoute() ? (
          <PostCommentsSheet
            visible={commentsVisible}
            post={post}
            userId={userId}
            authorProfile={authorProfile}
            initialDraft={commentDraft}
            onClose={closeComments}
            presentation="videoOverlay"
          />
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.root, webTabSceneShell]}>
      <ImmersiveVideoViewer
        item={item}
        mediaIndex={mediaIndex}
        stageWidth={width}
        stageHeight={height}
        isActive
        playbackHandoff={resumeHandoff}
        routePlayback
        postActions={videoPostActions}
        onClose={onBack}
        commentsOverlayOpen={commentsVisible}
      />
      {Platform.OS === "web" && usesMobileWebCommentsRoute() ? (
        <PostCommentsSheet
          visible={commentsVisible}
          post={post}
          userId={userId}
          authorProfile={authorProfile}
          initialDraft={commentDraft}
          onClose={closeComments}
          presentation="videoOverlay"
        />
      ) : null}
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
