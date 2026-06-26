import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, router } from "expo-router";
import { View, StyleSheet } from "react-native";
import { useState } from "react";
import {
  getErrorMessage,
  getOrCreateConversation,
  getProfileByUsername,
  getProfileStats,
  getPostsByUser,
  isFollowing,
} from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { ProfileScreenContent } from "@/components/ProfileScreenContent";
import { usePostActions } from "@/lib/usePostActions";
import { useModeration } from "@/lib/useModeration";
import { useFollowUser } from "@/lib/useFollowUser";
import { DetailLoading } from "@/components/DetailLoading";
import { showAlert } from "@/lib/alerts";
import { EmptyState, colors } from "@frennix/ui";

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const [messaging, setMessaging] = useState(false);
  const { openPostActions, postActionSheets } = usePostActions({ userId });
  const { moderationSheets, openUserModeration } = useModeration(userId);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["profile", username],
    queryFn: () => getProfileByUsername(username!),
    enabled: !!username,
  });

  const { data: following } = useQuery({
    queryKey: ["is-following", userId, profile?.id],
    queryFn: () => isFollowing(userId, profile!.id),
    enabled: !!profile?.id && profile.id !== userId,
  });

  const { data: stats } = useQuery({
    queryKey: ["profile-stats", profile?.id],
    queryFn: () => getProfileStats(profile!.id),
    enabled: !!profile?.id,
  });

  const { data: postsPage } = useQuery({
    queryKey: ["user-posts", profile?.id, userId],
    queryFn: () => getPostsByUser(profile!.id, userId),
    enabled: !!profile?.id && !!userId,
  });

  const followMutation = useFollowUser(userId);

  function showModerationAlert(title: string, message: string) {
    showAlert(title, message);
  }

  async function messageUser() {
    if (!profile) return;
    if (!userId) {
      showModerationAlert("Sign in required", "Sign in to send messages.");
      return;
    }

    setMessaging(true);
    try {
      const convId = await getOrCreateConversation(userId, profile.id);
      router.push(`/chat/${convId}`);
    } catch (e) {
      showModerationAlert("Could not open chat", getErrorMessage(e));
    } finally {
      setMessaging(false);
    }
  }

  function showModeration() {
    if (!profile) return;
    openUserModeration(profile.id);
  }

  if (profileLoading) return <DetailLoading />;
  if (!profile) {
    return (
      <View style={styles.notFound}>
        <EmptyState
          title="Profile not found"
          description="This user may not exist, has been blocked, or their profile is unavailable."
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const isOwn = profile.id === userId;

  return (
    <>
      {moderationSheets}
      <ProfileScreenContent
        profile={profile}
        stats={stats ?? { posts: 0, followers: 0, following: 0, eventsJoined: 0, workoutStreak: 0 }}
        posts={postsPage?.posts ?? []}
        isOwn={isOwn}
        following={following}
        onFollow={() => {
          if (!userId) {
            showModerationAlert("Sign in required", "Sign in to follow people.");
            return;
          }
          followMutation.mutate({ targetUserId: profile.id, isFollowing: !!following });
        }}
        onMessage={messageUser}
        onModeration={showModeration}
        followLoading={followMutation.isPending}
        messageLoading={messaging}
        currentUserId={isOwn ? userId : undefined}
        onOwnerActionsPress={isOwn ? openPostActions : undefined}
        postActionSheet={isOwn ? postActionSheets : undefined}
      />
    </>
  );
}

const styles = StyleSheet.create({
  notFound: { flex: 1, backgroundColor: colors.background, justifyContent: "center" },
});
