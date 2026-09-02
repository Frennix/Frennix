import { memo, useMemo } from "react";
import { Platform, View } from "react-native";
import type { Post } from "@frennix/types";
import { FeedPostCard, getSharedPostTargetId } from "@frennix/ui";
import { buildFeedPostAnchorId } from "@/lib/web-feed-scroll-port";

export type FeedListItemActions = {
  onPress: (post: Post) => void;
  onInteractPress: (post: Post, mediaIndex?: number) => void;
  onAuthorPress: (post: Post) => void;
  onCommentAuthorPress: (username: string) => void;
  onLike: (post: Post) => void;
  onDoubleTapLike?: (post: Post) => void;
  onComment: (post: Post) => void;
  onShare: (post: Post) => void;
  onSave: (post: Post) => void;
  onReaction: (post: Post, emoji: string) => void;
  onModerationPress: (post: Post) => void;
  onOwnerActionsPress: (post: Post) => void;
  onMediaPress: (post: Post, uri: string, index: number) => void;
  videoRouteHrefForMedia?: (post: Post, mediaIndex: number) => string | undefined;
  onVideoRouteNavigate?: (post: Post, mediaIndex: number) => void;
};

type FeedListItemProps = {
  post: Post;
  userId: string;
  actions: FeedListItemActions;
  interactionActive?: boolean;
  /** When true, mount feed media (images/videos). Deferred until row is near viewport. */
  mediaActive?: boolean;
  mediaPageIndex?: number;
  onMediaPageIndexChange?: (index: number) => void;
  inlineComposerEnabled?: boolean;
};

function feedItemPropsEqual(prev: FeedListItemProps, next: FeedListItemProps) {
  if (prev.userId !== next.userId) return false;
  if (prev.mediaActive !== next.mediaActive) return false;
  if (prev.mediaPageIndex !== next.mediaPageIndex) return false;
  if (prev.interactionActive !== next.interactionActive) return false;
  if (prev.inlineComposerEnabled !== next.inlineComposerEnabled) return false;
  if (prev.onMediaPageIndexChange !== next.onMediaPageIndexChange) return false;
  if (prev.post.id !== next.post.id) return false;

  const a = prev.post;
  const b = next.post;

  return (
    a.liked_by_me === b.liked_by_me &&
    a.like_count === b.like_count &&
    a.comment_count === b.comment_count &&
    a.saved_by_me === b.saved_by_me &&
    a.my_reaction === b.my_reaction &&
    a.content === b.content &&
    a.updated_at === b.updated_at &&
    a.media_urls === b.media_urls &&
    a.reactions === b.reactions &&
    a.preview_comments === b.preview_comments
  );
}

export const FeedListItem = memo(function FeedListItem({
  post,
  userId,
  actions,
  interactionActive = false,
  mediaActive = true,
  mediaPageIndex,
  onMediaPageIndexChange,
  inlineComposerEnabled = true,
}: FeedListItemProps) {
  const handlers = useMemo(
    () => ({
      onPress: () => actions.onPress(post),
      onInteractPress: (mediaIndex?: number) => actions.onInteractPress(post, mediaIndex),
      onAuthorPress: () => actions.onAuthorPress(post),
      onCommentAuthorPress: actions.onCommentAuthorPress,
      onLike: () => actions.onLike(post),
      onDoubleTapLike: actions.onDoubleTapLike ? () => actions.onDoubleTapLike!(post) : undefined,
      onComment: () => actions.onComment(post),
      onShare: () => actions.onShare(post),
      onSave: () => actions.onSave(post),
      onReaction: (emoji: string) => actions.onReaction(post, emoji),
      onModerationPress: () => actions.onModerationPress(post),
      onOwnerActionsPress: () => actions.onOwnerActionsPress(post),
      onMediaPress: (uri: string, index: number) => actions.onMediaPress(post, uri, index),
      videoRouteHrefForIndex: actions.videoRouteHrefForMedia
        ? (index: number) => actions.videoRouteHrefForMedia!(post, index)
        : undefined,
      onVideoRouteNavigate: actions.onVideoRouteNavigate
        ? (index: number) => actions.onVideoRouteNavigate!(post, index)
        : undefined,
    }),
    [actions, post]
  );

  return (
    <View
      collapsable={false}
      nativeID={buildFeedPostAnchorId(getSharedPostTargetId(post))}
      {...(Platform.OS === "web"
        ? ({ "data-feed-post-id": getSharedPostTargetId(post) } as object)
        : null)}
    >
      <FeedPostCard
      post={post}
      isOwn={post.author_id === userId}
      interactionActive={interactionActive}
      onPress={handlers.onPress}
      onInteractPress={handlers.onInteractPress}
      onAuthorPress={handlers.onAuthorPress}
      onCommentAuthorPress={handlers.onCommentAuthorPress}
      onLike={handlers.onLike}
      onDoubleTapLike={handlers.onDoubleTapLike}
      onComment={handlers.onComment}
      onShare={handlers.onShare}
      onSave={handlers.onSave}
      onReaction={handlers.onReaction}
      onModerationPress={handlers.onModerationPress}
      onOwnerActionsPress={handlers.onOwnerActionsPress}
      onMediaPress={handlers.onMediaPress}
      videoRouteHrefForIndex={handlers.videoRouteHrefForIndex}
      onVideoRouteNavigate={handlers.onVideoRouteNavigate}
      mediaActive={mediaActive}
      mediaPageIndex={mediaPageIndex}
      onMediaPageIndexChange={onMediaPageIndexChange}
      inlineComposerEnabled={inlineComposerEnabled}
    />
    </View>
  );
}, feedItemPropsEqual);
