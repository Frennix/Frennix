import { memo, useMemo } from "react";
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
import { getSharedPostTargetId, SharedPostPreview } from "./SharedPostPreview";
import { MenuIconButton } from "./MenuIconButton";
import { colors, spacing, typography } from "./theme";

interface FeedPostCardProps {
  post: Post & { author?: Profile };
  onPress?: () => void;
  onInteractPress?: (mediaIndex?: number) => void;
  interactionActive?: boolean;
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
  onInteractPress,
  interactionActive = false,
  onComment,
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
  const openInteraction = onInteractPress;

  const handleMediaPress = useMemo(() => {
    if (!openInteraction) return onMediaPress;
    return (_uri: string, index: number) => {
      openInteraction(index);
    };
  }, [onMediaPress, openInteraction]);

  return (
    <View style={[styles.container, interactionActive && styles.containerActive]}>
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
          <MenuIconButton onPress={onOwnerActionsPress} accessibilityLabel="Post options" />
        ) : onModerationPress ? (
          <MenuIconButton onPress={onModerationPress} accessibilityLabel="Post options" />
        ) : null}
      </View>

      {showCaption ? (
        <Pressable
          onPress={() => (openInteraction ? openInteraction() : onPress?.())}
          disabled={!openInteraction && !onPress}
          accessibilityRole="button"
          accessibilityLabel="Open post actions"
        >
          <Text style={styles.caption}>{post.content}</Text>
        </Pressable>
      ) : null}

      {isShared && sharedPost ? (
        <SharedPostPreview
          post={sharedPost}
          onPress={() => (openInteraction ? openInteraction() : onPress?.())}
          onMediaPress={handleMediaPress}
        />
      ) : hasMedia ? (
        <FeedMediaSlot
          mediaUrls={displayPost.media_urls ?? []}
          postType={displayPost.post_type}
          thumbnailUrl={displayPost.thumbnail_url}
          style={styles.media}
          onMediaPress={handleMediaPress}
          pageIndex={mediaPageIndex}
          onPageIndexChange={onMediaPageIndexChange}
          visible={mediaActive}
        />
      ) : !showCaption && post.content ? (
        <Pressable
          onPress={() => (openInteraction ? openInteraction() : onPress?.())}
          disabled={!openInteraction && !onPress}
          accessibilityRole="button"
          accessibilityLabel="Open post actions"
        >
          <Text style={styles.textOnlyBody}>{post.content}</Text>
        </Pressable>
      ) : null}

      <View style={styles.footer}>
        {engagement ? <Text style={styles.engagement}>{engagement}</Text> : null}
        {reactionSummary ? <Text style={styles.reactionSummary}>{reactionSummary}</Text> : null}

        <ReactionBar
          reactions={post.reactions}
          onReactionPress={onReaction}
          onAddReaction={openInteraction ? () => openInteraction() : undefined}
        />

        <FeedCommentPreview
          comments={post.preview_comments}
          commentCount={post.comment_count}
          onCommentPress={onComment}
          onViewAllPress={onComment}
          onAuthorPress={onCommentAuthorPress}
        />
      </View>
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
  containerActive: {
    backgroundColor: colors.surfaceElevated,
    borderBottomColor: colors.accent,
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
});
