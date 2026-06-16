import { router } from "expo-router";
import { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Post, Profile, ProfileStats } from "@frennix/types";
import { formatActivity, formatGoal } from "@/lib/labels";
import { getProfileBio } from "@/lib/profile";
import { avatarDisplayUri } from "@/lib/avatar";
import {
  Button,
  Chip,
  EditableAvatar,
  PostGrid,
  WorkoutStreakBadge,
  colors,
  radius,
  spacing,
  typography,
} from "@frennix/ui";

interface ProfileScreenContentProps {
  profile: Profile;
  stats: ProfileStats;
  posts: Post[];
  isOwn: boolean;
  onAvatarPress?: () => void;
  avatarUploading?: boolean;
  avatarError?: string | null;
  following?: boolean;
  onFollow?: () => void;
  onMessage?: () => void;
  onModeration?: () => void;
  followLoading?: boolean;
  messageLoading?: boolean;
  currentUserId?: string;
  onOwnerActionsPress?: (post: Post) => void;
  postActionSheet?: ReactNode;
}

function ProfileSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function ProfileScreenContent({
  profile,
  stats,
  posts,
  isOwn,
  onAvatarPress,
  avatarUploading,
  avatarError,
  following,
  onFollow,
  onMessage,
  onModeration,
  followLoading,
  messageLoading,
  currentUserId,
  onOwnerActionsPress,
  postActionSheet,
}: ProfileScreenContentProps) {
  const bio = getProfileBio(profile);
  const avatarUri = avatarDisplayUri(profile.avatar_url, profile.updated_at);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {postActionSheet}
      <View style={styles.hero}>
        <EditableAvatar
          uri={avatarUri}
          name={profile.display_name}
          size={128}
          onPress={isOwn ? onAvatarPress : undefined}
          uploading={avatarUploading}
        />
        {avatarError ? <Text style={styles.avatarError}>{avatarError}</Text> : null}
        <Text style={styles.name}>{profile.display_name}</Text>
        <Text style={styles.username}>@{profile.username}</Text>
        {bio ? <Text style={styles.bio}>{bio}</Text> : null}

        {isOwn ? (
          <>
            <Button
              title="Edit Profile"
              variant="secondary"
              onPress={() => router.push("/edit-profile")}
              style={styles.editButton}
            />
            <Button
              title="Saved Posts"
              variant="secondary"
              onPress={() => router.push("/saved-posts")}
              style={styles.savedButton}
            />
            <Button
              title="Invite Friends"
              variant="secondary"
              onPress={() => router.push("/invite-friends")}
              style={styles.savedButton}
            />
          </>
        ) : null}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{stats.posts}</Text>
          <Text style={styles.statLabel}>Posts</Text>
        </View>
        <Pressable
          style={styles.stat}
          onPress={() => router.push(`/followers/${profile.id}`)}
        >
          <Text style={styles.statNum}>{stats.followers}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </Pressable>
        <Pressable
          style={styles.stat}
          onPress={() => router.push(`/following/${profile.id}`)}
        >
          <Text style={styles.statNum}>{stats.following}</Text>
          <Text style={styles.statLabel}>Following</Text>
        </Pressable>
      </View>

      <WorkoutStreakBadge streak={stats.workoutStreak} />

      {profile.fitness_goals?.length ? (
        <ProfileSection title="Fitness Goals">
          <View style={styles.chips}>
            {profile.fitness_goals.map((goal) => (
              <Chip key={goal} label={formatGoal(goal)} selected />
            ))}
          </View>
        </ProfileSection>
      ) : null}

      {profile.activities?.length ? (
        <ProfileSection title="Workout Interests">
          <View style={styles.chips}>
            {profile.activities.map((activity) => (
              <Chip key={activity} label={formatActivity(activity)} selected />
            ))}
          </View>
        </ProfileSection>
      ) : null}

      {profile.city ? (
        <ProfileSection title="Location">
          <View style={styles.locationRow}>
            <Text style={styles.locationIcon}>📍</Text>
            <Text style={styles.locationText}>{profile.city}</Text>
          </View>
        </ProfileSection>
      ) : null}

      {!isOwn ? (
        <View style={styles.actions}>
          <Button
            title={following ? "Following" : "Follow"}
            variant={following ? "secondary" : "primary"}
            onPress={onFollow}
            loading={followLoading}
          />
          <Button
            title="Message"
            variant="secondary"
            onPress={onMessage}
            loading={messageLoading}
          />
          <Button title="Report / Block" variant="ghost" onPress={onModeration} />
        </View>
      ) : null}

      <Text style={styles.postsTitle}>Posts</Text>
      <PostGrid
        posts={posts}
        onPressPost={(id) => router.push(`/post/${id}`)}
        currentUserId={currentUserId}
        onOwnerActionsPress={onOwnerActionsPress}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxl },
  hero: {
    alignItems: "center",
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  name: { ...typography.title, fontSize: 26, marginTop: spacing.sm },
  username: { ...typography.caption, color: colors.accent },
  bio: {
    ...typography.body,
    textAlign: "center",
    color: colors.textSecondary,
    lineHeight: 24,
    marginTop: spacing.xs,
    maxWidth: 340,
  },
  editButton: { width: "100%", marginTop: spacing.md },
  savedButton: { width: "100%" },
  avatarError: {
    ...typography.bodySmall,
    color: colors.danger,
    textAlign: "center",
    marginTop: spacing.xs,
    maxWidth: 320,
  },
  statsRow: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
  },
  stat: { flex: 1, alignItems: "center" },
  statNum: { ...typography.heading, color: colors.accent },
  statLabel: { ...typography.caption, marginTop: 2 },
  section: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    ...typography.body,
    fontWeight: "700",
    marginBottom: spacing.sm,
    color: colors.text,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  locationRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  locationIcon: { fontSize: 16 },
  locationText: { ...typography.body, color: colors.textSecondary },
  actions: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  postsTitle: {
    ...typography.heading,
    fontSize: 18,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
});
