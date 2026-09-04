import { useQuery } from "@tanstack/react-query";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { getPost } from "@frennix/api";
import { DetailLoading } from "@/components/DetailLoading";
import { PostVideoScreen } from "@/components/PostVideoScreen";
import { flexFill } from "@/lib/flex-layout";
import { hideFrennixBootShell } from "@/lib/hide-boot-shell";
import { usesMobileWebVideoRoute } from "@/lib/mobile-web-video-route";
import { requestFeedScrollReturnRestore } from "@/lib/web-feed-scroll-restore";
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

function consumeInitialResumeHandoff(postId: string | undefined): FeedVideoFullscreenHandoff | undefined {
  if (Platform.OS !== "web" || !postId) return undefined;
  const pending = consumeVideoViewerReturnState();
  if (!pending || pending.postId !== postId) return undefined;
  return toResumeHandoff(pending);
}

/** Opaque shell marker — recognized by inline boot shell as an authenticated destination. */
function VideoRouteShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (Platform.OS !== "web") return;
    hideFrennixBootShell();
  }, []);

  return (
    <View
      style={styles.routeShell}
      {...(Platform.OS === "web"
        ? ({
            nativeID: "frennix-video-route",
            "data-frennix-video-route": "true",
          } as object)
        : null)}
    >
      {children}
    </View>
  );
}

export default function PostVideoRoute() {
  const params = useLocalSearchParams<{ postId: string; mediaIndex?: string }>();
  const postId = Array.isArray(params.postId) ? params.postId[0] : params.postId;
  const mediaIndex = parseMediaIndex(params.mediaIndex);
  const { session, profile } = useAuth();
  const userId = session?.user.id ?? "";
  const [resumeHandoff, setResumeHandoff] = useState<FeedVideoFullscreenHandoff | undefined>(() =>
    consumeInitialResumeHandoff(postId)
  );

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
      requestFeedScrollReturnRestore();
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)");
  }, []);

  let content: ReactNode;

  if (!userId) {
    content = <DetailLoading />;
  } else if (!postId) {
    content = (
      <UnavailableVideoScreen
        message="This video link is invalid."
        onBack={handleBack}
      />
    );
  } else if (isLoading) {
    content = <DetailLoading />;
  } else if (isError || !post) {
    content = (
      <UnavailableVideoScreen
        message="This post is unavailable or may have been deleted."
        onBack={handleBack}
      />
    );
  } else if (Platform.OS === "web" && !usesMobileWebVideoRoute()) {
    content = <DetailLoading />;
  } else {
    content = (
      <PostVideoScreen
        post={post}
        mediaIndex={mediaIndex}
        resumeHandoff={resumeHandoff}
        userId={userId}
        authorProfile={profile ?? undefined}
        onBack={handleBack}
      />
    );
  }

  return (
    <VideoRouteShell>
      {content}
    </VideoRouteShell>
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
  routeShell: {
    ...flexFill,
    backgroundColor: colors.background,
  },
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
