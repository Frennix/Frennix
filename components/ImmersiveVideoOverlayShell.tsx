import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import type { Post } from "@frennix/types";
import { ImmersiveVideoPlaylistViewer } from "@/components/ImmersiveVideoPlaylistViewer";
import { PostCommentsSheet } from "@/components/PostCommentsSheet";
import { ImmersiveVideoCommentsProvider } from "@/lib/immersive-video-comments-context";
import type { ImmersiveVideoGalleryContext } from "@/lib/immersive-video-gallery";
import type { ImmersiveVideoPlaylistState } from "@/lib/immersive-video-playlist-state";
import { usesMobileWebCommentsRoute } from "@/lib/mobile-web-comments-route";

type ImmersiveVideoOverlayShellProps = {
  playlist: ImmersiveVideoPlaylistState;
  userId: string;
  authorProfile?: Post["author"];
  stageWidth: number;
  stageHeight: number;
  onClose: () => void;
  onActiveEntryChange?: (entry: { postId: string; mediaIndex: number }) => void;
  /** Deep-link /video route — all slides use route playback (no feed DOM adopt). */
  routePlayback?: boolean;
};

export function ImmersiveVideoOverlayShell({
  playlist,
  userId,
  authorProfile,
  stageWidth,
  stageHeight,
  onClose,
  onActiveEntryChange,
  routePlayback = false,
}: ImmersiveVideoOverlayShellProps) {
  const initialEntry = playlist.entries[playlist.initialIndex];
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [commentDraft, setCommentDraft] = useState<string | undefined>();
  const [activeEntry, setActiveEntry] = useState(() => ({
    postId: initialEntry?.postId ?? "",
    mediaIndex: initialEntry?.mediaIndex ?? playlist.originMediaIndex,
  }));
  const [runtimeTestEnabled, setRuntimeTestEnabled] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    if (!(window as Window & { __FRENNIX_PLAYLIST_RUNTIME_TEST__?: boolean }).__FRENNIX_PLAYLIST_RUNTIME_TEST__) {
      return;
    }
    setRuntimeTestEnabled(true);
  }, []);

  const closeComments = useCallback(() => {
    setCommentsVisible(false);
    setCommentDraft(undefined);
  }, []);

  const openCommentsOverlay = useCallback((draft?: string) => {
    setCommentDraft(draft);
    setCommentsVisible(true);
  }, []);

  const wrappedBuildImmersiveContext = useCallback(
    (post: Post): ImmersiveVideoGalleryContext | undefined => {
      const context = playlist.buildImmersiveContext(post);
      if (!context) return undefined;
      return {
        ...context,
        postActions: {
          ...context.postActions,
          onComment: (_playback, draft) => {
            if (Platform.OS === "web" && usesMobileWebCommentsRoute()) {
              openCommentsOverlay(draft);
              return;
            }
            context.postActions.onComment(_playback, draft);
          },
        },
      };
    },
    [openCommentsOverlay, playlist]
  );

  const handleActiveEntryChange = useCallback(
    (entry: { postId: string; mediaIndex: number }) => {
      setActiveEntry(entry);
      onActiveEntryChange?.(entry);
    },
    [onActiveEntryChange]
  );

  const activePost = useMemo(
    () => playlist.getPost(activeEntry.postId),
    [activeEntry.postId, playlist]
  );

  const commentsAuthorProfile = activePost?.author ?? authorProfile;

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    if (!(window as Window & { __FRENNIX_PLAYLIST_RUNTIME_TEST__?: boolean }).__FRENNIX_PLAYLIST_RUNTIME_TEST__) {
      return;
    }
    setRuntimeTestEnabled(true);
  }, []);

  return (
    <ImmersiveVideoCommentsProvider openComments={openCommentsOverlay}>
      <View style={styles.root}>
        <ImmersiveVideoPlaylistViewer
          entries={playlist.entries}
          initialIndex={playlist.initialIndex}
          initialHandoff={playlist.initialHandoff}
          initialHandoffPlaybackId={playlist.initialHandoffPlaybackId}
          stageWidth={stageWidth}
          stageHeight={stageHeight}
          getPost={playlist.getPost}
          buildImmersiveContext={wrappedBuildImmersiveContext}
          hasMore={playlist.hasMore}
          fetchMore={playlist.fetchMore}
          onClose={onClose}
          onActiveEntryChange={handleActiveEntryChange}
          commentsOverlayOpen={commentsVisible}
          routePlayback={routePlayback}
        />
        {Platform.OS === "web" && usesMobileWebCommentsRoute() && activePost ? (
          <PostCommentsSheet
            visible={commentsVisible}
            post={activePost}
            userId={userId}
            authorProfile={commentsAuthorProfile}
            initialDraft={commentDraft}
            onClose={closeComments}
            presentation="videoOverlay"
          />
        ) : null}
        {runtimeTestEnabled ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open comments runtime test"
            onPress={() => openCommentsOverlay()}
            style={styles.runtimeTestTrigger}
          />
        ) : null}
      </View>
    </ImmersiveVideoCommentsProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: "hidden",
  },
  runtimeTestTrigger: Platform.select({
    web: {
      position: "absolute",
      top: 0,
      left: 0,
      width: 1,
      height: 1,
      opacity: 0,
      zIndex: 1,
    },
    default: {
      display: "none",
    },
  }),
});
