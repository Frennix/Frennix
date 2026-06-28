import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Post, Profile } from "@frennix/types";
import { normalizeWorkoutTypes } from "@frennix/types";
import { Avatar } from "./Avatar";
import { formatRelativeTime } from "./formatRelativeTime";
import { WorkoutTypeChips } from "./WorkoutTypeChips";
import { PostMediaCarousel } from "./PostMediaCarousel";
import { ReactionBar } from "./ReactionBar";
import { ReactionPicker } from "./ReactionPicker";
import { getSharedPostTargetId, SharedPostPreview } from "./SharedPostPreview";
import { MenuIconButton } from "./MenuIconButton";
import { colors, radius, spacing, typography } from "./theme";

interface PostCardProps {
  post: Post & { author?: Profile };
  onPress?: () => void;
  onLike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
  onSave?: () => void;
  onReaction?: (emoji: string) => void;
  onModerationPress?: () => void;
  onAuthorPress?: () => void;
  isOwn?: boolean;
  onOwnerActionsPress?: () => void;
  onMediaPress?: (uri: string, index: number) => void;
  mediaPageIndex?: number;
  onMediaPageIndexChange?: (index: number) => void;
}

export function PostCard({
  post,
  onPress,
  onLike,
  onComment,
  onShare,
  onSave,
  onReaction,
  onModerationPress,
  onAuthorPress,
  isOwn,
  onOwnerActionsPress,
  onMediaPress,
  mediaPageIndex,
  onMediaPageIndexChange,
}: PostCardProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const author = post.author;
  const sharedPost = post.shared_post;
  const isShared = Boolean(sharedPost ?? post.shared_post_id);
  const displayPost = sharedPost ?? post;
  const subtitle = isShared
    ? `Shared a post · ${formatRelativeTime(post.created_at)}`
    : formatRelativeTime(post.created_at);
  const workoutTypes = isShared ? [] : normalizeWorkoutTypes(displayPost);
  const hasMedia = Boolean(displayPost.media_urls?.length);

  return (
    <View style={styles.card}>
      {isOwn ? (
        <MenuIconButton
          style={styles.menuAnchor}
          onPress={onOwnerActionsPress}
          accessibilityLabel="Post options"
        />
      ) : onModerationPress ? (
        <MenuIconButton
          style={styles.menuAnchor}
          onPress={onModerationPress}
          accessibilityLabel="Post options"
        />
      ) : null}

      <Pressable style={styles.header} onPress={onAuthorPress}>
        <Avatar uri={author?.avatar_url} name={author?.display_name} size={44} />
        <View style={styles.headerText}>
          <Text style={styles.name}>{author?.display_name ?? "Unknown"}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          {workoutTypes.length ? (
            <WorkoutTypeChips types={workoutTypes} size="compact" style={styles.workoutChips} />
          ) : null}
        </View>
      </Pressable>

      {isShared && sharedPost ? (
        <SharedPostPreview post={sharedPost} onPress={onPress} onMediaPress={onMediaPress} />
      ) : (
        <>
          {post.content ? <Text style={styles.content}>{post.content}</Text> : null}
          {hasMedia ? (
            <PostMediaCarousel
              mediaUrls={displayPost.media_urls ?? []}
              postType={displayPost.post_type}
              thumbnailUrl={displayPost.thumbnail_url}
              onMediaPress={onMediaPress}
              pageIndex={mediaPageIndex}
              onPageIndexChange={onMediaPageIndexChange}
            />
          ) : null}
        </>
      )}

      <ReactionBar
        reactions={post.reactions}
        onReactionPress={onReaction}
        onAddReaction={onReaction ? () => setPickerOpen(true) : undefined}
      />

      <View style={styles.actions}>
        <Pressable onPress={onLike} hitSlop={8}>
          <Text style={[styles.action, post.liked_by_me && styles.liked]}>
            {post.liked_by_me ? "♥" : "♡"} {post.like_count ?? 0}
          </Text>
        </Pressable>
        {onReaction ? (
          <Pressable onPress={() => setPickerOpen(true)} hitSlop={8} accessibilityLabel="React">
            <Text style={[styles.action, post.my_reaction && styles.reacted]}>
              {post.my_reaction ?? "😊"} React
            </Text>
          </Pressable>
        ) : null}
        <Pressable onPress={onComment} hitSlop={8}>
          <Text style={styles.action}>💬 {post.comment_count ?? 0}</Text>
        </Pressable>
        {onShare ? (
          <Pressable onPress={onShare} hitSlop={8} accessibilityLabel="Share post">
            <Text style={styles.action}>↗ Share</Text>
          </Pressable>
        ) : null}
        {onSave ? (
          <Pressable
            onPress={onSave}
            hitSlop={8}
            accessibilityLabel={post.saved_by_me ? "Remove from saved" : "Save post"}
          >
            <Text style={[styles.action, post.saved_by_me && styles.saved]}>
              {post.saved_by_me ? "🔖 Saved" : "🔖 Save"}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {onReaction ? (
        <ReactionPicker
          visible={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={(emoji) => {
            setPickerOpen(false);
            onReaction(emoji);
          }}
        />
      ) : null}
    </View>
  );
}

export { getSharedPostTargetId };

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
    position: "relative",
  },
  menuAnchor: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 2,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
  },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingRight: spacing.xl },
  headerText: { flex: 1, gap: 2 },
  name: { ...typography.body, fontWeight: "600", color: colors.text },
  subtitle: { ...typography.caption, color: colors.textMuted },
  workoutChips: { marginTop: 4 },
  content: { ...typography.body, lineHeight: 22, color: colors.text },
  actions: { flexDirection: "row", gap: spacing.lg, paddingTop: spacing.xs },
  action: { ...typography.bodySmall, color: colors.textSecondary },
  liked: { color: colors.accent },
  reacted: { color: colors.accent, fontWeight: "600" },
  saved: { color: colors.accent, fontWeight: "600" },
});
