import { useQuery } from "@tanstack/react-query";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { getPost } from "@frennix/api";
import { DetailLoading } from "@/components/DetailLoading";
import { PostVideoScreen } from "@/components/PostVideoScreen";
import { usesMobileWebVideoRoute } from "@/lib/mobile-web-video-route";
import { useImmersiveVideoPostActions } from "@/lib/useImmersiveVideoPostActions";
import { restoreFeedScrollReturnState } from "@/lib/web-feed-scroll-restore";
import {
  consumeVideoViewerReturnState,
  type VideoViewerReturnState,
} from "@/lib/web-video-viewer-return";
import { useAuth } from "@/providers/AuthProvider";
import { colors, EmptyState, spacing, typography, type FeedVideoFullscreenHandoff } from "@frennix/ui";

function parseMediaIndex(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "0", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function toResumeHandoff(state: VideoViewerReturnState): FeedVideoFullscreenHandoff {
  return {
    playbackId: state.playbackId,
    mediaIndex: state.mediaIndex,
    currentTime: state.currentTime,
    muted: state.muted,
    wasPlaying: state.wasPlaying,
  };
}

export default function PostVideoRoute() {
  const params = useLocalSearchParams<{ postId: string; mediaIndex?: string }>();
  const postId = Array.isArray(params.postId) ? params.postId[0] : params.postId;
  const mediaIndex = parseMediaIndex(params.mediaIndex);
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const [resumeHandoff, setResumeHandoff] = useState<FeedVideoFullscreenHandoff | undefined>();

  const {
    data: post,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["post", postId, userId],
    queryFn: () => getPost(postId!, userId),
    enabled: !!postId && !!userId,
    retry: 1,
  });

  const postActions = useImmersiveVideoPostActions(post, userId);

  useFocusEffect(
    useCallback(() => {
      if (!postId) return;
      const pending = consumeVideoViewerReturnState();
      if (!pending || pending.postId !== postId) return;
      setResumeHandoff(toResumeHandoff(pending));
    }, [postId])
  );

  useEffect(() => {
    if (Platform.OS !== "web" || !postId || usesMobileWebVideoRoute()) return;
    router.replace(`/post/${postId}`);
  }, [postId]);

  const handleBack = useCallback(() => {
    if (Platform.OS === "web") {
      restoreFeedScrollReturnState();
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)");
  }, []);

  if (!userId) {
    return <DetailLoading />;
  }

  if (!postId) {
    return (
      <UnavailableVideoScreen
        message="This video link is invalid."
        onBack={handleBack}
      />
    );
  }

  if (isLoading) {
    return <DetailLoading />;
  }

  if (isError || !post) {
    return (
      <UnavailableVideoScreen
        message="This post is unavailable or may have been deleted."
        onBack={handleBack}
      />
    );
  }

  if (Platform.OS === "web" && !usesMobileWebVideoRoute()) {
    return <DetailLoading />;
  }

  if (!postActions) {
    return <DetailLoading />;
  }

  return (
    <PostVideoScreen
      post={post}
      mediaIndex={mediaIndex}
      resumeHandoff={resumeHandoff}
      postActions={postActions}
      onBack={handleBack}
    />
  );
}

function UnavailableVideoScreen({
  message,
  onBack,
}: {
  message: string;
  onBack: () => void;
}) {
  return (
    <View style={styles.unavailableRoot}>
      <EmptyState title="Video unavailable" description={message} />
      <Pressable onPress={onBack} style={styles.backLink} accessibilityRole="button">
        <Text style={styles.backLinkText}>Go back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  unavailableRoot: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  backLink: {
    alignSelf: "center",
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  backLinkText: {
    ...typography.body,
    color: colors.accent,
    fontWeight: "600",
  },
});
