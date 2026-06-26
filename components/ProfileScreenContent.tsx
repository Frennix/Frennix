import { router } from "expo-router";
import { ReactNode, useMemo, useState, type RefObject } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import type { Post, Profile, ProfileStats } from "@frennix/types";
import { computeProfileAchievements } from "@frennix/api";
import { formatActivity, formatGoal } from "@/lib/labels";
import { getProfileBio } from "@/lib/profile";
import { splitProfileActivities } from "@/lib/profile-interests";
import { avatarDisplayUri } from "@/lib/avatar";
import {
  Button,
  CachedImage,
  Chip,
  EditableAvatar,
  PostGrid,
  ProfileAchievementBadges,
  ProfileContentTab,
  ProfileContentTabs,
  WorkoutStreakBadge,
  colors,
  formatPresenceStatus,
  isProfileOnline,
  isVideoMedia,
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
  onCoverPress?: () => void;
  coverUploading?: boolean;
  coverError?: string | null;
  coverPreviewUri?: string | null;
  following?: boolean;
  onFollow?: () => void;
  onMessage?: () => void;
  onProfileMenuPress?: () => void;
  followLoading?: boolean;
  messageLoading?: boolean;
  currentUserId?: string;
  onOwnerActionsPress?: (post: Post) => void;
  postActionSheet?: ReactNode;
  profileActionSheet?: ReactNode;
  scrollViewRef?: RefObject<ScrollView>;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

const COVER_HEIGHT = 200;
const AVATAR_SIZE = 112;

function isPhotoPost(post: Post): boolean {
  if (post.post_type === "video") return false;
  if (post.post_type === "photo") return true;
  const url = post.media_urls?.[0];
  if (!url) return false;
  return !isVideoMedia(post.post_type, url);
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
  onCoverPress,
  coverUploading,
  coverError,
  coverPreviewUri,
  following,
  onFollow,
  onMessage,
  onProfileMenuPress,
  followLoading,
  messageLoading,
  currentUserId,
  onOwnerActionsPress,
  postActionSheet,
  profileActionSheet,
  scrollViewRef,
  onScroll,
}: ProfileScreenContentProps) {
  const [activeTab, setActiveTab] = useState<ProfileContentTab>("posts");
  const bio = getProfileBio(profile);
  const { sports, workoutInterests } = splitProfileActivities(profile.activities);
  const avatarUri = avatarDisplayUri(profile.avatar_url, profile.updated_at);
  const storedCoverUri = avatarDisplayUri(profile.cover_image_url, profile.updated_at);
  const coverUri = coverPreviewUri ?? storedCoverUri;
  const achievements = useMemo(() => computeProfileAchievements(stats), [stats]);
  const photoPosts = useMemo(() => posts.filter(isPhotoPost), [posts]);
  const presenceOnline = !isOwn && isProfileOnline(profile);
  const presenceLabel = !isOwn ? formatPresenceStatus(profile) : null;

  function handleCoverPress() {
    if (!onCoverPress || coverUploading) return;
    void onCoverPress();
  }

  return (
    <ScrollView
      ref={scrollViewRef}
      onScroll={onScroll}
      scrollEventThrottle={16}
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {postActionSheet}
      {profileActionSheet}

      <View style={styles.coverWrap}>
        {coverUri ? (
          <View style={styles.cover}>
            <CachedImage uri={coverUri} style={StyleSheet.absoluteFill} contentFit="cover" recyclingKey={`cover-${coverUri}`} />
            <View style={styles.coverOverlay} pointerEvents="none" />
          </View>
        ) : (
          <View style={[styles.cover, styles.coverEmpty]}>
            <View style={styles.coverFallback} pointerEvents="none">
              <View style={styles.coverAccentBand} />
              <View style={styles.coverPattern}>
                <Text style={styles.coverPatternText}>FRENNIX ATHLETE</Text>
              </View>
            </View>
          </View>
        )}

        {isOwn && onCoverPress ? (
          <Pressable
            style={styles.coverEditButton}
            onPress={handleCoverPress}
            disabled={coverUploading}
            accessibilityLabel="Change cover photo"
            accessibilityRole="button"
          >
            {coverUploading ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={styles.coverEditText}>Change cover</Text>
            )}
          </Pressable>
        ) : null}

        {coverError ? <Text style={styles.coverError}>{coverError}</Text> : null}
      </View>

      <View style={styles.identityBlock} pointerEvents="box-none">
        <View style={styles.avatarWrap}>
          <EditableAvatar
            uri={avatarUri}
            name={profile.display_name}
            size={AVATAR_SIZE}
            onPress={isOwn ? onAvatarPress : undefined}
            uploading={avatarUploading}
          />
        </View>
        {avatarError ? <Text style={styles.avatarError}>{avatarError}</Text> : null}

        <View style={styles.nameBlock}>
          <View style={styles.nameRow}>
            <View style={styles.nameTextBlock}>
              <Text style={styles.name}>{profile.display_name}</Text>
              <Text style={styles.username}>@{profile.username}</Text>
            </View>
            {onProfileMenuPress ? (
              <Pressable
                style={styles.menuButton}
                onPress={onProfileMenuPress}
                hitSlop={8}
                accessibilityLabel="Profile options"
              >
                <Text style={styles.menuIcon}>⋯</Text>
              </Pressable>
            ) : null}
          </View>
          {presenceLabel ? (
            <Text style={[styles.presence, presenceOnline && styles.presenceOnline]}>
              {presenceLabel}
            </Text>
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

        <View style={styles.actionRow}>
          {isOwn ? (
            <>
              <Button
                title="Edit Profile"
                variant="secondary"
                onPress={() => router.push("/edit-profile")}
                style={styles.actionButton}
              />
              <Button
                title="Saved"
                variant="ghost"
                onPress={() => router.push("/saved-posts")}
                style={styles.actionButtonCompact}
              />
            </>
          ) : (
            <>
              <Button
                title={following ? "Following" : "Follow"}
                variant={following ? "secondary" : "primary"}
                onPress={onFollow}
                loading={followLoading}
                style={styles.actionButton}
              />
              <Button
                title="Message"
                variant="secondary"
                onPress={onMessage}
                loading={messageLoading}
                style={styles.actionButton}
              />
            </>
          )}
        </View>

        {!isOwn ? null : (
          <Button
            title="Invite Friends"
            variant="ghost"
            onPress={() => router.push("/invite-friends")}
          />
        )}
      </View>

      <WorkoutStreakBadge streak={stats.workoutStreak} />

      {bio ? (
        <ProfileSection title="About">
          <Text style={styles.aboutText}>{bio}</Text>
        </ProfileSection>
      ) : null}

      {sports.length ? (
        <ProfileSection title="Sports">
          <View style={styles.chips}>
            {sports.map((sport) => (
              <Chip key={sport} label={formatActivity(sport)} selected />
            ))}
          </View>
        </ProfileSection>
      ) : null}

      {profile.fitness_goals?.length ? (
        <ProfileSection title="Fitness Goals">
          <View style={styles.chips}>
            {profile.fitness_goals.map((goal) => (
              <Chip key={goal} label={formatGoal(goal)} selected />
            ))}
          </View>
        </ProfileSection>
      ) : null}

      {workoutInterests.length ? (
        <ProfileSection title="Workout Interests">
          <View style={styles.chips}>
            {workoutInterests.map((activity) => (
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

      <ProfileAchievementBadges achievements={achievements} />

      <ProfileContentTabs
        active={activeTab}
        onChange={setActiveTab}
        postCount={posts.length}
        photoCount={photoPosts.length}
      />

      <PostGrid
        posts={activeTab === "photos" ? photoPosts : posts}
        onPressPost={(id) => router.push(`/post/${id}`)}
        currentUserId={currentUserId}
        onOwnerActionsPress={onOwnerActionsPress}
        fullWidth
        emptyLabel={activeTab === "photos" ? "No photos yet" : "No posts yet"}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxl },
  coverWrap: { position: "relative" },
  cover: {
    height: COVER_HEIGHT,
    width: "100%",
    justifyContent: "flex-end",
    backgroundColor: colors.surfaceElevated,
  },
  coverEmpty: {
    overflow: "hidden",
  },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  coverFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0F1A14",
  },
  coverAccentBand: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 80,
    backgroundColor: colors.accentMuted,
    opacity: 0.55,
  },
  coverPattern: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  coverPatternText: {
    ...typography.caption,
    letterSpacing: 4,
    color: "rgba(34, 197, 94, 0.35)",
    fontWeight: "700",
  },
  coverEditButton: {
    position: "absolute",
    right: spacing.md,
    bottom: spacing.md,
    zIndex: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    minWidth: 120,
    alignItems: "center",
  },
  coverEditText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: "700",
  },
  coverError: {
    ...typography.bodySmall,
    color: colors.danger,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  identityBlock: {
    paddingHorizontal: spacing.lg,
    marginTop: -AVATAR_SIZE / 2,
    gap: spacing.sm,
  },
  avatarWrap: {
    alignSelf: "flex-start",
    borderRadius: radius.full,
    borderWidth: 4,
    borderColor: colors.background,
    overflow: "hidden",
  },
  nameBlock: { marginTop: spacing.xs, gap: spacing.xs },
  nameRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm },
  nameTextBlock: { flex: 1 },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuIcon: { fontSize: 22, lineHeight: 24, color: colors.textSecondary, fontWeight: "700" },
  name: { ...typography.title, fontSize: 24 },
  username: { ...typography.caption, color: colors.accent, marginTop: 2 },
  presence: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  presenceOnline: { color: colors.accent, fontWeight: "600" },
  avatarError: {
    ...typography.bodySmall,
    color: colors.danger,
    maxWidth: 320,
  },
  statsRow: {
    flexDirection: "row",
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
  },
  stat: { flex: 1, alignItems: "center" },
  statNum: { ...typography.heading, color: colors.accent },
  statLabel: { ...typography.caption, marginTop: 2 },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionButton: { flex: 1 },
  actionButtonCompact: { minWidth: 88 },
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
  aboutText: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  locationRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  locationIcon: { fontSize: 16 },
  locationText: { ...typography.body, color: colors.textSecondary },
});
