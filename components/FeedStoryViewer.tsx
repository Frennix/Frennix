import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { FeedStory } from "@frennix/types";
import {
  Avatar,
  Button,
  PostMediaCarousel,
  colors,
  formatLastWorkoutLabel,
  formatStreakBadgeLabel,
  spacing,
  typography,
} from "@frennix/ui";

interface FeedStoryViewerProps {
  story: FeedStory | null;
  visible: boolean;
  onClose: () => void;
  onViewProfile?: (username: string) => void;
  onViewPost?: (postId: string) => void;
  onShareWorkout?: () => void;
}

export function FeedStoryViewer({
  story,
  visible,
  onClose,
  onViewProfile,
  onViewPost,
  onShareWorkout,
}: FeedStoryViewerProps) {
  if (!story) return null;

  const lastWorkout = story.last_workout;
  const streakLabel = formatStreakBadgeLabel(story.workout_streak);
  const lastWorkoutLabel = formatLastWorkoutLabel(lastWorkout);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
          <Text style={styles.title}>{story.is_self ? "Your story" : `@${story.profile.username}`}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.profileRow}>
          <Avatar uri={story.profile.avatar_url} name={story.profile.display_name} size={52} />
          <View style={styles.profileText}>
            <Text style={styles.displayName}>{story.profile.display_name}</Text>
            <Text style={styles.username}>@{story.profile.username}</Text>
            <Text style={[styles.streak, story.workout_streak > 0 && styles.streakActive]}>{streakLabel}</Text>
            <Text style={styles.lastWorkout}>{lastWorkoutLabel}</Text>
          </View>
        </View>

        {lastWorkout?.media_urls?.length ? (
          <PostMediaCarousel
            mediaUrls={lastWorkout.media_urls}
            postType={lastWorkout.post_type}
            thumbnailUrl={lastWorkout.thumbnail_url}
            style={styles.media}
          />
        ) : (
          <View style={styles.emptyMedia}>
            <Text style={styles.emptyEmoji}>🏋️</Text>
            <Text style={styles.emptyTitle}>
              {story.is_self ? "Share your latest workout" : "No workout posted yet"}
            </Text>
            <Text style={styles.emptyBody}>
              {story.is_self
                ? "Post a photo, video, or progress update to show up in stories."
                : `${story.profile.display_name} hasn't shared a workout recently.`}
            </Text>
          </View>
        )}

        {lastWorkout?.content ? <Text style={styles.caption}>{lastWorkout.content}</Text> : null}

        <View style={styles.actions}>
          {story.is_self && !lastWorkout ? (
            <Button title="Share workout" onPress={onShareWorkout} />
          ) : null}
          {!story.is_self ? (
            <Button
              title="View profile"
              variant="secondary"
              onPress={() => onViewProfile?.(story.profile.username)}
            />
          ) : null}
          {lastWorkout ? (
            <Button
              title="View post"
              variant={story.is_self && !lastWorkout ? "secondary" : "primary"}
              onPress={() => onViewPost?.(lastWorkout.post_id)}
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
    gap: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  close: {
    ...typography.body,
    color: colors.accent,
    fontWeight: "600",
  },
  title: {
    ...typography.body,
    fontWeight: "700",
    color: colors.text,
  },
  headerSpacer: { width: 48 },
  profileRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
  },
  profileText: { flex: 1, gap: 2 },
  displayName: { ...typography.body, fontWeight: "700", color: colors.text },
  username: { ...typography.caption, color: colors.accent },
  streak: { ...typography.bodySmall, color: colors.textMuted, marginTop: 2 },
  streakActive: { color: colors.accent, fontWeight: "700" },
  lastWorkout: { ...typography.caption, color: colors.textSecondary },
  media: {
    width: "100%",
    height: 360,
    borderRadius: 12,
    overflow: "hidden",
  },
  emptyMedia: {
    height: 280,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    gap: spacing.sm,
  },
  emptyEmoji: { fontSize: 40, lineHeight: 44 },
  emptyTitle: { ...typography.body, fontWeight: "700", color: colors.text, textAlign: "center" },
  emptyBody: { ...typography.bodySmall, color: colors.textMuted, textAlign: "center" },
  caption: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
  },
  actions: { gap: spacing.sm, marginTop: "auto" },
});
