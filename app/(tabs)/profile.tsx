import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { getPostsByUser, getProfileStats } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { ProfileScreenContent } from "@/components/ProfileScreenContent";
import { PostActionSheet } from "@/components/PostActionSheet";
import { useAvatarUpload } from "@/lib/useAvatarUpload";
import { usePostOwnerActions } from "@/lib/usePostOwnerActions";
import { colors } from "@frennix/ui";

export default function ProfileTabScreen() {
  const { session, profile, loading } = useAuth();
  const userId = session?.user.id ?? "";
  const { pickAndUploadAvatar, uploading, error } = useAvatarUpload();
  const { openPostActions, actionSheetProps } = usePostOwnerActions({ userId });

  const { data: stats } = useQuery({
    queryKey: ["profile-stats", userId],
    queryFn: () => getProfileStats(userId),
    enabled: !!userId,
  });

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

  return (
    <ProfileScreenContent
      profile={profile}
      stats={stats ?? { posts: 0, followers: 0, following: 0, eventsJoined: 0, workoutStreak: 0 }}
      posts={postsPage?.posts ?? []}
      isOwn
      onAvatarPress={pickAndUploadAvatar}
      avatarUploading={uploading}
      avatarError={error}
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
