import { memo, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Post, Profile } from "@frennix/types";
import { Avatar } from "./Avatar";
import { ScalePressable } from "./ScalePressable";
import { FeedCommentPreview } from "./FeedCommentPreview";
import {
  formatEngagementSummary,
  formatFeedPostHeaderMeta,
  formatReactionSummary,
} from "./formatRelativeTime";
import { WorkoutTypeChips } from "./WorkoutTypeChips";
import { normalizeWorkoutTypes } from "@frennix/types";
import { PostMediaCarousel } from "./PostMediaCarousel";
import { FeedMediaSlot } from "./FeedMediaSlot";
import { ReactionBar } from "./ReactionBar";
import { ReactionPicker } from "./ReactionPicker";
import { getSharedPostTargetId, SharedPostPreview } from "./SharedPostPreview";
import { colors, spacing, typography } from "./theme";

interface FeedPostCardProps {
  post: Post & { author?: Profile };
  onPress?: () => void;
  onLike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
  onSave?: () => void;
  onReaction?: (emoji: string) => void;
  onModerationPress?: () => void;
  onAuthorPress?: () => void;
  onCommentAuthorPress?: (username: string) => void;
  isOwn?: boolean;
  onOwnerActionsPress?: () => void;
  onMediaPress?: (uri: string, index: number) => void;
  /** Defer heavy media until the row is near the viewport. */
  mediaActive?: boolean;
  mediaPageIndex?: number;
  onMediaPageIndexChange?: (index: number) => void;
}

export const FeedPostCard = memo(function FeedPostCard({
  post,
  onPress,
  onLike,
  onComment,
  onShare,
  onSave,
  onReaction,
  onModerationPress,
  onAuthorPress,
  onCommentAuthorPress,
  isOwn,
  onOwnerActionsPress,
  onMediaPress,
  mediaActive = true,
  mediaPageIndex,
  onMediaPageIndexChange,
}: FeedPostCardProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const author = post.author;
  const sharedPost = post.shared_post;
  const isShared = Boolean(sharedPost ?? post.shared_post_id);
  const displayPost = sharedPost ?? post;
  const meta = useMemo(() => formatFeedPostHeaderMeta(post, isShared), [post, isShared]);
  const workoutTypes = useMemo(
    () => (isShared ? [] : normalizeWorkoutTypes(displayPost)),
    [displayPost, isShared]
  );
  const engagement = useMemo(() => formatEngagementSummary(post), [post]);
  const reactionSummary = useMemo(() => formatReactionSummary(post.reactions), [post.reactions]);
  const hasMedia = Boolean(displayPost.media_urls?.length);
  const showCaption = Boolean(post.content) && !isShared;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <ScalePressable containerStyle={styles.header} onPress={onAuthorPress} disabled={!onAuthorPress}>
          <Avatar uri={author?.avatar_url} name={author?.display_name} size={44} />
          <View style={styles.headerText}>
            <Text style={styles.name}>{author?.display_name ?? "Unknown"}</Text>
            {author?.username ? <Text style={styles.username}>@{author.username}</Text> : null}
            <Text style={styles.meta}>{meta}</Text>
            {workoutTypes.length ? (
              <WorkoutTypeChips types={workoutTypes} maxVisible={3} size="compact" style={styles.workoutChips} />
            ) : null}
          </View>
        </ScalePressable>

        {isOwn ? (
          <Pressable
            style={styles.menuButton}
            onPress={onOwnerActionsPress}
            hitSlop={8}
            accessibilityLabel="Post options"
          >
            <Text style={styles.menuIcon}>⋯</Text>
          </Pressable>
        ) : onModerationPress ? (
          <Pressable
            style={styles.menuButton}
            onPress={onModerationPress}
            hitSlop={8}
            accessibilityLabel="Post options"
          >
            <Text style={styles.menuIcon}>⋯</Text>
          </Pressable>
        ) : null}
      </View>

      {showCaption ? <Text style={styles.caption}>{post.content}</Text> : null}

      {isShared && sharedPost ? (
        <SharedPostPreview post={sharedPost} onPress={onPress} onMediaPress={onMediaPress} />
      ) : hasMedia ? (
        <FeedMediaSlot
          mediaUrls={displayPost.media_urls ?? []}
          postType={displayPost.post_type}
          thumbnailUrl={displayPost.thumbnail_url}
          style={styles.media}
          onMediaPress={onMediaPress}
          pageIndex={mediaPageIndex}
          onPageIndexChange={onMediaPageIndexChange}
          visible={mediaActive}
        />
      ) : !showCaption && post.content ? (
        <Pressable
          onPress={onPress}
          onLongPress={onReaction ? () => setPickerOpen(true) : undefined}
          delayLongPress={350}
          disabled={!onPress && !onReaction}
        >
          <Text style={styles.textOnlyBody}>{post.content}</Text>
        </Pressable>
      ) : null}

      <View style={styles.footer}>
        <View style={styles.actions}>
          <Pressable onPress={onLike} hitSlop={8} style={styles.actionButton}>
            <Text style={[styles.action, post.liked_by_me && styles.liked]}>
              {post.liked_by_me ? "♥" : "♡"} Like
            </Text>
          </Pressable>
          {onReaction ? (
            <Pressable
              onPress={() => setPickerOpen(true)}
              hitSlop={8}
              style={styles.actionButton}
              accessibilityLabel="React"
            >
              <Text style={[styles.action, post.my_reaction && styles.reacted]}>
                {post.my_reaction ?? "😊"} React
              </Text>
            </Pressable>
          ) : null}
          <Pressable onPress={onComment} hitSlop={8} style={styles.actionButton}>
            <Text style={styles.action}>💬 Comment</Text>
          </Pressable>
          {onShare ? (
            <Pressable onPress={onShare} hitSlop={8} style={styles.actionButton}>
              <Text style={styles.action}>↗ Share</Text>
            </Pressable>
          ) : null}
          {onSave ? (
            <Pressable
              onPress={onSave}
              hitSlop={8}
              style={styles.actionButton}
              accessibilityLabel={post.saved_by_me ? "Remove from saved" : "Save post"}
            >
              <Text style={[styles.action, post.saved_by_me && styles.saved]}>
                {post.saved_by_me ? "🔖 Saved" : "🔖 Save"}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {engagement ? <Text style={styles.engagement}>{engagement}</Text> : null}
        {reactionSummary ? <Text style={styles.reactionSummary}>{reactionSummary}</Text> : null}

        <ReactionBar
          reactions={post.reactions}
          onReactionPress={onReaction}
          onAddReaction={onReaction ? () => setPickerOpen(true) : undefined}
        />

        <FeedCommentPreview
          comments={post.preview_comments}
          commentCount={post.comment_count}
          onCommentPress={onComment}
          onViewAllPress={onComment}
          onAuthorPress={onCommentAuthorPress}
        />
      </View>

      {onReaction && pickerOpen ? (
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
});

export { getSharedPostTargetId };

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  header: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  headerText: { flex: 1, gap: 2 },
  name: { ...typography.body, fontWeight: "700", color: colors.text },
  username: { ...typography.caption, color: colors.accent },
  meta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  workoutChips: { marginTop: 4 },
  menuButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  menuIcon: {
    fontSize: 20,
    lineHeight: 22,
    color: colors.textSecondary,
    fontWeight: "700",
  },
  caption: {
    ...typography.body,
    lineHeight: 22,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  textOnlyBody: {
    ...typography.body,
    lineHeight: 24,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  media: {
    width: "100%",
    borderRadius: 0,
    marginTop: spacing.xs,
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  engagement: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  reactionSummary: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: "700",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  actionButton: { paddingVertical: 2 },
  action: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: "600" },
  liked: { color: colors.accent },
  reacted: { color: colors.accent },
  saved: { color: colors.accent },
});
