import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { ProfileTabSkeleton } from "@/components/ProfileTabSkeleton";
import { getFollowingIds, getPostsByUser, getProfileStats } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { ProfileScreenContent } from "@/components/ProfileScreenContent";
import { useAvatarUpload } from "@/lib/useAvatarUpload";
import { useCoverUpload } from "@/lib/useCoverUpload";
import { usePostActions } from "@/lib/usePostActions";
import { useProfileActions } from "@/lib/useProfileActions";
import { scrollScrollViewToTop, handleTabRetap } from "@/lib/tab-scroll-registry";
import { useScrollAtTop } from "@/lib/useScrollAtTop";
import { useTabScrollRegistration } from "@/lib/useTabScrollRegistration";
import { useTabScreenWebHeightStyle } from "@/lib/screen-shell";
import { useGuardedRefresh } from "@/lib/useGuardedRefresh";
import { TabScreenBoundary } from "@/components/TabScreenBoundary";
import { EmptyState, colors, spacing } from "@frennix/ui";

const EMPTY_STATS = {
  posts: 0,
  followers: 0,
  following: 0,
  eventsJoined: 0,
  workoutStreak: 0,
} as const;

export default function ProfileTabScreen() {
  const { session, profile, authReady, loading } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();
  const { pickAndUploadAvatar, uploading, error } = useAvatarUpload();
  const { pickAndUploadCover, uploading: coverUploading, error: coverError, previewUri: coverPreviewUri } = useCoverUpload();
  const { openPostActions, postActionSheets } = usePostActions({ userId });
  const { openProfileActions, profileActionSheets } = useProfileActions({
    userId,
    profile,
  });
  const scrollRef = useRef<ScrollView>(null);
  const webShellStyle = useTabScreenWebHeightStyle();
  const { onScroll, isAtTop } = useScrollAtTop();

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["profile-stats", userId],
    queryFn: () => getProfileStats(userId),
    enabled: !!userId,
    staleTime: 120_000,
    placeholderData: (previousData) => previousData,
  });

  const { data: followingIds = [], refetch: refetchFollowingIds } = useQuery({
    queryKey: ["following-ids", userId],
    queryFn: () => getFollowingIds(userId),
    enabled: !!userId,
    staleTime: 120_000,
    placeholderData: (previousData) => previousData,
  });

  const { data: postsPage, refetch: refetchPosts } = useQuery({
    queryKey: ["user-posts", userId, userId],
    queryFn: () => getPostsByUser(userId, userId),
    enabled: !!userId,
    staleTime: 120_000,
    placeholderData: (previousData) => previousData,
  });

  const refreshProfile = useCallback(async () => {
    await Promise.all([refetchStats(), refetchFollowingIds(), refetchPosts()]);
  }, [refetchFollowingIds, refetchPosts, refetchStats]);

  const [profileRefreshing, setProfileRefreshing] = useState(false);
  const onPullRefresh = useGuardedRefresh(
    useCallback(async () => {
      setProfileRefreshing(true);
      try {
        await refreshProfile();
      } finally {
        setProfileRefreshing(false);
      }
    }, [refreshProfile]),
    { errorTitle: "Could not refresh profile" }
  );

  useTabScrollRegistration(
    "profile",
    useCallback(
      () =>
        handleTabRetap({
          isAtTop,
          scrollToTop: () => scrollScrollViewToTop(scrollRef.current),
          refresh: () => {
            void refreshProfile();
          },
        }),
      [isAtTop, refreshProfile]
    )
  );

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      const statsState = queryClient.getQueryState(["profile-stats", userId]);
      if (statsState?.isInvalidated || statsState?.status === "pending") {
        void queryClient.invalidateQueries({ queryKey: ["profile-stats", userId] });
      }
    }, [queryClient, userId])
  );

  if (!profile && (loading || !authReady)) {
    return <ProfileTabSkeleton />;
  }

  if (!profile) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background, padding: spacing.lg }}>
        <EmptyState
          title="Profile unavailable"
          description="We couldn't load your profile. Pull to refresh or try signing in again."
          actionLabel="Go to settings"
          onAction={() => router.push("/settings")}
        />
      </View>
    );
  }

  const baseStats = stats ?? EMPTY_STATS;
  const displayStats = {
    ...baseStats,
    following: Math.max(baseStats.following, followingIds.length),
  };

  return (
    <TabScreenBoundary label="profile">
    <ProfileScreenContent
      profile={profile}
      stats={displayStats}
      posts={postsPage?.posts ?? []}
      isOwn
      onAvatarPress={pickAndUploadAvatar}
      avatarUploading={uploading}
      avatarError={error}
      onCoverPress={pickAndUploadCover}
      coverUploading={coverUploading}
      coverError={coverError}
      coverPreviewUri={coverPreviewUri}
      currentUserId={userId}
      onOwnerActionsPress={openPostActions}
      onProfileMenuPress={openProfileActions}
      postActionSheet={postActionSheets}
      profileActionSheet={profileActionSheets}
      scrollViewRef={scrollRef}
      onScroll={onScroll}
      onRefresh={() => void onPullRefresh()}
      refreshing={profileRefreshing}
      webShellStyle={webShellStyle}
    />
    </TabScreenBoundary>
  );
}

