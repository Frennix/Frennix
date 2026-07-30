import { memo, useCallback, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import type { Post, Profile } from "@frennix/types";
import { Avatar } from "./Avatar";
import { ScalePressable } from "./ScalePressable";
import { FeedCommentPreview } from "./FeedCommentPreview";
import {
  formatEngagementSummary,
  formatFeedCompactHeaderMeta,
  formatFeedPostHeaderMeta,
  formatReactionSummary,
} from "./formatRelativeTime";
import { normalizeWorkoutTypes } from "@frennix/types";
import { ReactionBar } from "./ReactionBar";
import { getSharedPostTargetId, SharedPostPreview } from "./SharedPostPreview";
import { WorkoutStatsPills } from "./WorkoutStatsPills";
import { WorkoutTypeChips } from "./WorkoutTypeChips";
import { formatWorkoutTypeLabel } from "./formatRelativeTime";
import { colors } from "./theme";
import {
  FeedLayout,
  FeedMedia,
  FeedPostActionBar,
  feedAccessibility,
  feedLayout,
  feedLayoutTypography,
  type FeedPostLayoutSlots,
} from "./feed-layout";

interface FeedPostCardProps {
  post: Post & { author?: Profile };
  /** Optional extension slots for sponsored, premium, affiliate, etc. — omit for standard posts. */
  slots?: FeedPostLayoutSlots;
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
  /** Double-tap media to like (Instagram-style). */
  onDoubleTapLike?: () => void;
  /** Defer heavy media until the row is near the viewport. */
  mediaActive?: boolean;
  mediaPageIndex?: number;
  onMediaPageIndexChange?: (index: number) => void;
}

const STRONG_WORK_EMOJI = "💪";

function splitWorkoutCopy(content: string | null | undefined): {
  title: string | null;
  description: string | null;
} {
  if (!content?.trim()) return { title: null, description: null };
  const lines = content.trim().split(/\n+/);
  const title = lines[0]?.trim() ?? null;
  const description = lines.slice(1).join("\n").trim() || null;
  return { title, description };
}

export const FeedPostCard = memo(function FeedPostCard({
  post,
  onPress,
  onInteractPress,
  interactionActive = false,
  onLike,
  onComment,
  onShare,
  onReaction,
  onModerationPress,
  onAuthorPress,
  onCommentAuthorPress,
  isOwn,
  onOwnerActionsPress,
  onMediaPress,
  onDoubleTapLike,
  mediaActive = true,
  mediaPageIndex,
  onMediaPageIndexChange,
  slots,
}: FeedPostCardProps) {
  const author = post.author;
  const sharedPost = post.shared_post;
  const isShared = Boolean(sharedPost ?? post.shared_post_id);
  const displayPost = sharedPost ?? post;
  const workoutTypes = useMemo(
    () => (isShared ? [] : normalizeWorkoutTypes(displayPost)),
    [displayPost, isShared]
  );
  const headerMeta = useMemo(
    () =>
      isShared
        ? formatFeedPostHeaderMeta(post, true)
        : formatFeedCompactHeaderMeta(displayPost, workoutTypes),
    [displayPost, isShared, post, workoutTypes]
  );
  const engagement = useMemo(() => formatEngagementSummary(post), [post]);
  const reactionSummary = useMemo(() => formatReactionSummary(post.reactions), [post.reactions]);
  const hasMedia = Boolean(displayPost.media_urls?.length);
  const showCaption = Boolean(post.content);
  const { title: contentTitle, description: contentDescription } = useMemo(
    () => splitWorkoutCopy(isShared ? post.content : displayPost.content),
    [displayPost.content, isShared, post.content]
  );
  const workoutTitle = useMemo(() => {
    if (contentTitle) return contentTitle;
    const primary = workoutTypes[0];
    if (primary) return `${formatWorkoutTypeLabel(primary)} Workout`;
    return null;
  }, [contentTitle, workoutTypes]);
  const workoutDescription = contentDescription ?? (contentTitle ? null : displayPost.content);

  const handleMorePress = useMemo(() => {
    if (onInteractPress) return () => onInteractPress();
    if (isOwn && onOwnerActionsPress) return onOwnerActionsPress;
    if (onModerationPress) return onModerationPress;
    return undefined;
  }, [isOwn, onInteractPress, onModerationPress, onOwnerActionsPress]);

  const handleStrongWork = useMemo(
    () => (onReaction ? () => onReaction(STRONG_WORK_EMOJI) : undefined),
    [onReaction]
  );

  const openPostDetail = onPress;

  const lastMediaTapAt = useRef(0);
  const heartScale = useRef(new Animated.Value(0)).current;
  const [heartVisible, setHeartVisible] = useState(false);

  const playLikeHeart = useCallback(() => {
    setHeartVisible(true);
    heartScale.setValue(0);
    Animated.sequence([
      Animated.spring(heartScale, {
        toValue: 1,
        friction: 4,
        tension: 120,
        useNativeDriver: true,
      }),
      Animated.timing(heartScale, {
        toValue: 0,
        duration: 240,
        delay: 350,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setHeartVisible(false);
    });
  }, [heartScale]);

  const handleMediaAreaPress = useCallback(() => {
    if (!onDoubleTapLike) return;
    const now = Date.now();
    if (now - lastMediaTapAt.current < 280) {
      lastMediaTapAt.current = 0;
      onDoubleTapLike();
      playLikeHeart();
      return;
    }
    lastMediaTapAt.current = now;
  }, [onDoubleTapLike, playLikeHeart]);

  return (
    <FeedLayout.Root active={interactionActive}>
      <FeedLayout.Label>{slots?.label}</FeedLayout.Label>

      <FeedLayout.Header>
        <ScalePressable
          containerStyle={styles.headerMain}
          onPress={onAuthorPress}
          disabled={!onAuthorPress}
          accessibilityRole="button"
          accessibilityLabel={`${author?.display_name ?? "Unknown"}${author?.username ? `, @${author.username}` : ""}. ${headerMeta}`}
          accessibilityHint="Opens author profile"
        >
          <Avatar uri={author?.avatar_url} name={author?.display_name} size={feedLayout.header.avatarSize} />
          <FeedLayout.HeaderText>
            <Text
              style={feedLayoutTypography.displayName}
              allowFontScaling
              maxFontSizeMultiplier={feedAccessibility.maxFontSizeMultiplier}
            >
              {author?.display_name ?? "Unknown"}
            </Text>
            <Text
              style={feedLayoutTypography.username}
              allowFontScaling
              maxFontSizeMultiplier={feedAccessibility.maxFontSizeMultiplier}
              numberOfLines={1}
            >
              {author?.username ? `@${author.username}` : ""}
            </Text>
            <Text
              style={feedLayoutTypography.meta}
              allowFontScaling
              maxFontSizeMultiplier={feedAccessibility.maxFontSizeMultiplier}
              numberOfLines={1}
            >
              {headerMeta}
            </Text>
          </FeedLayout.HeaderText>
        </ScalePressable>
        <FeedLayout.HeaderTrailing>
          {slots?.headerTrailing}
          {handleMorePress ? (
            <Pressable
              onPress={handleMorePress}
              hitSlop={8}
              style={styles.headerMoreButton}
              accessibilityRole="button"
              accessibilityLabel="More post actions"
            >
              <Text style={styles.headerMoreIcon}>⋯</Text>
            </Pressable>
          ) : null}
        </FeedLayout.HeaderTrailing>
      </FeedLayout.Header>

      {isShared && sharedPost ? (
        <FeedLayout.Media embedded>
          <SharedPostPreview
            post={sharedPost}
            onPress={() => (onPress ? onPress() : onInteractPress?.())}
            onMediaPress={onMediaPress}
          />
        </FeedLayout.Media>
      ) : hasMedia ? (
        <View style={styles.mediaTapShell}>
          <Pressable onPress={onDoubleTapLike ? handleMediaAreaPress : undefined} disabled={!onDoubleTapLike}>
            <FeedMedia
              mediaUrls={displayPost.media_urls ?? []}
              postType={displayPost.post_type}
              thumbnailUrl={displayPost.thumbnail_url}
              onMediaPress={onMediaPress}
              pageIndex={mediaPageIndex}
              onPageIndexChange={onMediaPageIndexChange}
              visible={mediaActive}
              overlay={slots?.mediaOverlay}
            />
          </Pressable>
          {heartVisible ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.likeHeartOverlay,
                {
                  opacity: heartScale.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0, 1, 0.85],
                  }),
                  transform: [{ scale: heartScale }],
                },
              ]}
            >
              <Text style={styles.likeHeartIcon}>♥</Text>
            </Animated.View>
          ) : null}
        </View>
      ) : null}

      {workoutTitle ? (
        <FeedLayout.Caption>
          <Text
            style={feedLayoutTypography.workoutTitle}
            allowFontScaling
            maxFontSizeMultiplier={feedAccessibility.maxFontSizeMultiplier}
          >
            {workoutTitle}
          </Text>
        </FeedLayout.Caption>
      ) : null}

      {workoutDescription ? (
        <FeedLayout.Caption>
          <Pressable
            onPress={openPostDetail}
            disabled={!openPostDetail}
            accessibilityRole="button"
            accessibilityLabel="View full post"
          >
            <Text
              style={feedLayoutTypography.workoutDescription}
              allowFontScaling
              maxFontSizeMultiplier={feedAccessibility.maxFontSizeMultiplier}
            >
              {workoutDescription}
            </Text>
          </Pressable>
        </FeedLayout.Caption>
      ) : null}

      {!isShared && workoutTypes.length > 0 ? (
        <FeedLayout.BelowMedia>
          <WorkoutTypeChips types={workoutTypes} size="default" />
        </FeedLayout.BelowMedia>
      ) : null}

      {!isShared ? (
        <FeedLayout.BelowMedia>
          <WorkoutStatsPills
            metrics={displayPost.workout_metrics}
            milestones={displayPost.story_milestones}
          />
        </FeedLayout.BelowMedia>
      ) : null}

      <FeedLayout.BelowMedia>{slots?.belowMedia}</FeedLayout.BelowMedia>

      <FeedPostActionBar
        liked={Boolean(post.liked_by_me)}
        strongWorkActive={post.my_reaction === STRONG_WORK_EMOJI}
        onLike={onLike}
        onStrongWork={handleStrongWork}
        onComment={onComment}
        onShare={onShare}
      />

      {showCaption && isShared ? (
        <FeedLayout.Caption>
          <Pressable
            onPress={openPostDetail}
            disabled={!openPostDetail}
            accessibilityRole="button"
            accessibilityLabel="View full post"
            accessibilityHint={post.content ? post.content.slice(0, 120) : undefined}
          >
            <Text
              style={feedLayoutTypography.caption}
              allowFontScaling
              maxFontSizeMultiplier={feedAccessibility.maxFontSizeMultiplier}
            >
              {post.content}
            </Text>
          </Pressable>
        </FeedLayout.Caption>
      ) : null}

      <FeedLayout.Commerce>{slots?.commerce}</FeedLayout.Commerce>

      {(engagement || reactionSummary || post.reactions?.length) ? (
        <FeedLayout.Engagement>
          {engagement ? (
            <Text
              style={feedLayoutTypography.engagement}
              allowFontScaling
              maxFontSizeMultiplier={feedAccessibility.maxFontSizeMultiplier}
              accessibilityRole="text"
            >
              {engagement}
            </Text>
          ) : null}
          {reactionSummary ? (
            <Text
              style={feedLayoutTypography.reactionSummary}
              allowFontScaling
              maxFontSizeMultiplier={feedAccessibility.maxFontSizeMultiplier}
              accessibilityRole="text"
            >
              {reactionSummary}
            </Text>
          ) : null}
          <ReactionBar reactions={post.reactions} onReactionPress={onReaction} compact />
        </FeedLayout.Engagement>
      ) : null}

      <FeedLayout.Comments>
        <FeedCommentPreview
          comments={post.preview_comments}
          commentCount={post.comment_count}
          onCommentPress={onComment}
          onViewAllPress={onComment}
          onAuthorPress={onCommentAuthorPress}
        />
      </FeedLayout.Comments>

      <FeedLayout.Footer>{slots?.footer}</FeedLayout.Footer>
    </FeedLayout.Root>
  );
});

export { getSharedPostTargetId };

const styles = StyleSheet.create({
  headerMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: feedLayout.header.gap,
  },
  headerMoreButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  headerMoreIcon: {
    fontSize: 22,
    lineHeight: 24,
    color: colors.textMuted,
    fontWeight: "700",
  },
  mediaTapShell: {
    position: "relative",
    alignSelf: "stretch",
    maxWidth: "100%",
    minWidth: 0,
  },
  likeHeartOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  likeHeartIcon: {
    fontSize: 88,
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
});
