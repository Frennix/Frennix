import { useCallback, useMemo, useState } from "react";
import { Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { normalizePostMediaItems } from "@frennix/types";
import type { Post } from "@frennix/types";
import { ImmersiveVideoViewer } from "@/components/ImmersiveVideoViewer";
import { PostCommentsSheet } from "@/components/PostCommentsSheet";
import type { ImmersiveVideoGalleryContext } from "@/lib/immersive-video-gallery";
import { usesMobileWebCommentsRoute } from "@/lib/mobile-web-comments-route";
import { flexFill, webTabSceneShell } from "@/lib/flex-layout";
import type { FeedVideoFullscreenHandoff } from "@frennix/ui";
import { colors } from "@frennix/ui";

type PostVideoScreenProps = {
  post: Post;
  mediaIndex: number;
  resumeHandoff?: FeedVideoFullscreenHandoff;
  postActions: ImmersiveVideoGalleryContext["postActions"];
  userId: string;
  authorProfile?: Post["author"];
  onBack: () => void;
};

export function PostVideoScreen({
  post,
  mediaIndex,
  resumeHandoff,
  postActions,
  userId,
  authorProfile,
  onBack,
}: PostVideoScreenProps) {
  const { width, height } = useWindowDimensions();
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [commentDraft, setCommentDraft] = useState<string | undefined>();

  const displayPost = post.shared_post ?? post;
  const mediaItems = normalizePostMediaItems(displayPost.media_urls ?? [], {
    postType: displayPost.post_type,
    thumbnailUrl: displayPost.thumbnail_url,
  });
  const item = mediaItems[mediaIndex];

  const closeComments = useCallback(() => {
    setCommentsVisible(false);
    setCommentDraft(undefined);
  }, []);

  const openCommentsOverlay = useCallback((draft?: string) => {
    setCommentDraft(draft);
    setCommentsVisible(true);
  }, []);

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
    return (
      <View style={[styles.unavailableRoot, webTabSceneShell]} />
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
