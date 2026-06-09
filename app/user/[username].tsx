import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, router } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  followUser,
  getOrCreateConversation,
  getProfileByUsername,
  getFollowers,
  getFollowing,
  getPostsByUser,
  isFollowing,
  unfollowUser,
  blockUser,
  reportContent,
} from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { formatActivity, formatGoal } from "@/lib/labels";
import { Avatar, Button, PostGrid, colors, spacing, typography } from "@frennix/ui";

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { session, profile: me } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile", username],
    queryFn: () => getProfileByUsername(username!),
    enabled: !!username,
  });

  const { data: following } = useQuery({
    queryKey: ["is-following", userId, profile?.id],
    queryFn: () => isFollowing(userId, profile!.id),
    enabled: !!profile?.id && profile.id !== userId,
  });

  const { data: followers = [] } = useQuery({
    queryKey: ["followers", profile?.id],
    queryFn: () => getFollowers(profile!.id),
    enabled: !!profile?.id,
  });

  const { data: followingList = [] } = useQuery({
    queryKey: ["following", profile?.id],
    queryFn: () => getFollowing(profile!.id),
    enabled: !!profile?.id,
  });

  const { data: postsPage } = useQuery({
    queryKey: ["user-posts", profile?.id, userId],
    queryFn: () => getPostsByUser(profile!.id, userId),
    enabled: !!profile?.id && !!userId,
  });

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!profile) return;
      if (following) await unfollowUser(userId, profile.id);
      else await followUser(userId, profile.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["is-following"] }),
  });

  async function messageUser() {
    if (!profile) return;
    const convId = await getOrCreateConversation(userId, profile.id);
    router.push(`/chat/${convId}`);
  }

  function showModeration() {
    if (!profile) return;
    Alert.alert("User options", undefined, [
      {
        text: "Report user",
        onPress: () =>
          reportContent({ reporter_id: userId, reported_user_id: profile.id, reason: "Inappropriate profile" }),
      },
      {
        text: "Block user",
        style: "destructive",
        onPress: () => blockUser(userId, profile.id),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  if (!profile) return null;
  const isOwn = profile.id === userId;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Avatar uri={profile.avatar_url} name={profile.display_name} size={96} />
      <Text style={styles.name}>{profile.display_name}</Text>
      <Text style={styles.username}>@{profile.username}</Text>
      {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
      {profile.city ? <Text style={styles.city}>{profile.city}</Text> : null}

      <View style={styles.stats}>
        <Pressable style={styles.stat} onPress={() => router.push(`/followers/${profile.id}`)}>
          <Text style={styles.statNum}>{followers.length}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </Pressable>
        <Pressable style={styles.stat} onPress={() => router.push(`/following/${profile.id}`)}>
          <Text style={styles.statNum}>{followingList.length}</Text>
          <Text style={styles.statLabel}>Following</Text>
        </Pressable>
      </View>

      {profile.fitness_goals?.length ? (
        <Text style={styles.tags}>Goals: {profile.fitness_goals.map(formatGoal).join(" · ")}</Text>
      ) : null}
      {profile.activities?.length ? (
        <Text style={styles.tags}>Activities: {profile.activities.map(formatActivity).join(" · ")}</Text>
      ) : null}

      {!isOwn ? (
        <View style={styles.actions}>
          <Button
            title={following ? "Following" : "Follow"}
            variant={following ? "secondary" : "primary"}
            onPress={() => followMutation.mutate()}
            loading={followMutation.isPending}
          />
          <Button title="Message" variant="secondary" onPress={messageUser} />
          <Button title="Report / Block" variant="ghost" onPress={showModeration} />
        </View>
      ) : null}

      <Text style={styles.postsTitle}>Posts</Text>
      <PostGrid
        posts={postsPage?.posts ?? []}
        onPressPost={(id) => router.push(`/post/${id}`)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, alignItems: "center", gap: spacing.sm },
  name: { ...typography.title, fontSize: 24 },
  username: { ...typography.caption },
  bio: { ...typography.bodySmall, textAlign: "center", marginTop: spacing.sm },
  city: { ...typography.caption, color: colors.accent },
  stats: { flexDirection: "row", justifyContent: "center", gap: spacing.xl, marginVertical: spacing.sm },
  stat: { alignItems: "center" },
  statNum: { ...typography.heading },
  statLabel: { ...typography.caption },
  tags: { ...typography.bodySmall, textAlign: "center", lineHeight: 22 },
  actions: { width: "100%", gap: spacing.sm, marginTop: spacing.lg },
  postsTitle: { ...typography.heading, fontSize: 18, alignSelf: "flex-start", width: "100%", marginTop: spacing.md },
});
