import { Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { normalizePostMediaItems } from "@frennix/types";
import type { Post } from "@frennix/types";
import { ImmersiveVideoViewer } from "@/components/ImmersiveVideoViewer";
import type { ImmersiveVideoGalleryContext } from "@/lib/immersive-video-gallery";
import { flexFill, webTabSceneShell } from "@/lib/flex-layout";
import type { FeedVideoFullscreenHandoff } from "@frennix/ui";
import { colors } from "@frennix/ui";

type PostVideoScreenProps = {
  post: Post;
  mediaIndex: number;
  resumeHandoff?: FeedVideoFullscreenHandoff;
  postActions: ImmersiveVideoGalleryContext["postActions"];
  onBack: () => void;
};

export function PostVideoScreen({
  post,
  mediaIndex,
  resumeHandoff,
  postActions,
  onBack,
}: PostVideoScreenProps) {
  const { width, height } = useWindowDimensions();
  const displayPost = post.shared_post ?? post;
  const mediaItems = normalizePostMediaItems(displayPost.media_urls ?? [], {
    postType: displayPost.post_type,
    thumbnailUrl: displayPost.thumbnail_url,
  });
  const item = mediaItems[mediaIndex];

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
        postActions={postActions}
        onClose={onBack}
      />
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
