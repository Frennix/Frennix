import { useMemo } from "react";
import { router } from "expo-router";
import type { Post } from "@frennix/types";
import type { ImmersiveVideoPostActions } from "@/lib/immersive-video-gallery";
import {
  buildCommentsRouteHref,
  navigateToPostCommentsFromVideoViewer,
  usesMobileWebCommentsRoute,
} from "@/lib/mobile-web-comments-route";
import { useFeedLike } from "@/lib/useFeedLike";
import { usePostActions } from "@/lib/usePostActions";
import { usePostReaction } from "@/lib/usePostReaction";
import { useSharePost } from "@/lib/useSharePost";
import { useSuggestedFollow } from "@/lib/useSuggestedFollow";
import { pushScreen } from "@/lib/press-utils";

const STRONG_WORK_EMOJI = "💪";

export function useImmersiveVideoPostActions(
  post: Post | undefined,
  userId: string
): ImmersiveVideoPostActions | undefined {
  const { toggleLikePost } = useFeedLike(userId);
  const postReaction = usePostReaction(userId);
  const { openShare } = useSharePost(userId);
  const { openPostActions } = usePostActions({
    userId,
    onShareInApp: (target) => openShare(target.shared_post ?? target),
  });
  const { toggleFollow, isFollowing } = useSuggestedFollow(userId, { enabled: !!post });

  return useMemo(() => {
    if (!post) return undefined;

    const displayPost = post.shared_post ?? post;
    const authorId = post.author?.id;
    const showFollow = Boolean(authorId && authorId !== userId && !isFollowing(authorId));

    return {
      post,
      onLike: () => toggleLikePost(post.id),
      onRespect: () =>
        postReaction.mutate({
          postId: post.id,
          emoji: STRONG_WORK_EMOJI,
          currentEmoji: post.my_reaction,
        }),
      onComment: (playback, draft) => {
        if (
          usesMobileWebCommentsRoute() &&
          navigateToPostCommentsFromVideoViewer(post, playback, displayPost.media_urls ?? [], {
            draft,
            thumbnailUrl: displayPost.thumbnail_url,
            postType: displayPost.post_type,
          })
        ) {
          return;
        }
        router.push(buildCommentsRouteHref(post, draft));
      },
      onShare: () => openShare(post.shared_post ?? post),
      onMore: () => openPostActions(post),
      onAuthorPress: () => {
        if (post.author?.username) pushScreen(`/user/${post.author.username}`);
      },
      onFollow: authorId ? () => toggleFollow(authorId) : undefined,
      showFollow,
    };
  }, [
    isFollowing,
    openPostActions,
    openShare,
    post,
    postReaction,
    toggleFollow,
    toggleLikePost,
    userId,
  ]);
}
