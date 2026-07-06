import { memo, useMemo } from "react";
import { Pressable, Text } from "react-native";
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
  /** Defer heavy media until the row is near the viewport. */
  mediaActive?: boolean;
  mediaPageIndex?: number;
  onMediaPageIndexChange?: (index: number) => void;
}

const STRONG_WORK_EMOJI = "💪";

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

  return (
    <FeedLayout.Root active={interactionActive}>
      <FeedLayout.Label>{slots?.label}</FeedLayout.Label>

      <FeedLayout.Header>
        <ScalePressable
          containerStyle={{ flex: 1, flexDirection: "row", alignItems: "center", gap: feedLayout.header.gap }}
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
              style={feedLayoutTypography.meta}
              allowFontScaling
              maxFontSizeMultiplier={feedAccessibility.maxFontSizeMultiplier}
              numberOfLines={2}
            >
              {author?.username ? `@${author.username} · ` : ""}
              {headerMeta}
            </Text>
          </FeedLayout.HeaderText>
        </ScalePressable>
        <FeedLayout.HeaderTrailing>{slots?.headerTrailing}</FeedLayout.HeaderTrailing>
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
      ) : null}

      <FeedLayout.BelowMedia>{slots?.belowMedia}</FeedLayout.BelowMedia>

      <FeedPostActionBar
        liked={Boolean(post.liked_by_me)}
        strongWorkActive={post.my_reaction === STRONG_WORK_EMOJI}
        onLike={onLike}
        onStrongWork={handleStrongWork}
        onComment={onComment}
        onShare={onShare}
        onMore={handleMorePress}
      />

      {showCaption ? (
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
