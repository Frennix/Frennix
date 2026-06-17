import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { getFollowingIds, getPostsByUser, getProfileStats } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { ProfileScreenContent } from "@/components/ProfileScreenContent";
import { PostActionSheet } from "@/components/PostActionSheet";
import { useAvatarUpload } from "@/lib/useAvatarUpload";
import { useCoverUpload } from "@/lib/useCoverUpload";
import { usePostOwnerActions } from "@/lib/usePostOwnerActions";
import { colors } from "@frennix/ui";

const EMPTY_STATS = {
  posts: 0,
  followers: 0,
  following: 0,
  eventsJoined: 0,
  workoutStreak: 0,
} as const;

export default function ProfileTabScreen() {
  const { session, profile, loading } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();
  const { pickAndUploadAvatar, uploading, error } = useAvatarUpload();
  const { pickAndUploadCover, uploading: coverUploading, error: coverError } = useCoverUpload();
  const { openPostActions, actionSheetProps } = usePostOwnerActions({ userId });

  const { data: stats } = useQuery({
    queryKey: ["profile-stats", userId],
    queryFn: () => getProfileStats(userId),
    enabled: !!userId,
  });

  const { data: followingIds = [] } = useQuery({
    queryKey: ["following-ids", userId],
    queryFn: () => getFollowingIds(userId),
    enabled: !!userId,
  });

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      void queryClient.invalidateQueries({ queryKey: ["profile-stats", userId] });
      void queryClient.invalidateQueries({ queryKey: ["following-ids", userId] });
    }, [queryClient, userId])
  );

  const { data: postsPage } = useQuery({
    queryKey: ["user-posts", userId, userId],
    queryFn: () => getPostsByUser(userId, userId),
    enabled: !!userId,
  });

  if (loading || !profile) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const baseStats = stats ?? EMPTY_STATS;
  const displayStats = {
    ...baseStats,
    following: Math.max(baseStats.following, followingIds.length),
  };

  return (
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
      currentUserId={userId}
      onOwnerActionsPress={openPostActions}
      postActionSheet={<PostActionSheet {...actionSheetProps} />}
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
});
