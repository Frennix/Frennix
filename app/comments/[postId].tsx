import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { getPost } from "@frennix/api";
import { DetailLoading } from "@/components/DetailLoading";
import { PostCommentsScreen } from "@/components/PostCommentsScreen";
import { usesMobileWebCommentsRoute } from "@/lib/mobile-web-comments-route";
import { restoreFeedScrollReturnState } from "@/lib/web-feed-scroll-restore";
import { useAuth } from "@/providers/AuthProvider";
import { colors, EmptyState, spacing, typography } from "@frennix/ui";

export default function PostCommentsRoute() {
  const params = useLocalSearchParams<{ postId: string; draft?: string }>();
  const postId = Array.isArray(params.postId) ? params.postId[0] : params.postId;
  const draftParam = Array.isArray(params.draft) ? params.draft[0] : params.draft;
  const { session, profile } = useAuth();
  const userId = session?.user.id ?? "";

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

  useEffect(() => {
    if (Platform.OS !== "web" || !postId || usesMobileWebCommentsRoute()) return;
    router.replace(`/post/${postId}${draftParam ? `?draft=${encodeURIComponent(draftParam)}` : ""}`);
  }, [draftParam, postId]);

  if (!userId) {
    return <DetailLoading />;
  }

  if (!postId) {
    return (
      <UnavailableCommentsScreen
        message="This comments link is invalid."
        onBack={handleBack}
      />
    );
  }

  if (isLoading) {
    return <DetailLoading />;
  }

  if (isError || !post) {
    return (
      <UnavailableCommentsScreen
        message="This post is unavailable or may have been deleted."
        onBack={handleBack}
      />
    );
  }

  if (Platform.OS === "web" && !usesMobileWebCommentsRoute()) {
    return <DetailLoading />;
  }

  return (
    <PostCommentsScreen
      post={post}
      userId={userId}
      authorProfile={profile ?? undefined}
      initialDraft={draftParam}
      onBack={handleBack}
    />
  );
}

function UnavailableCommentsScreen({
  message,
  onBack,
}: {
  message: string;
  onBack: () => void;
}) {
  return (
    <View style={styles.unavailableRoot}>
      <EmptyState title="Comments unavailable" description={message} />
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
