import { useCallback } from "react";
import type { Post } from "@frennix/types";
import type { ImmersiveVideoGalleryContext } from "@/lib/immersive-video-gallery";
import {
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

export function useBuildImmersiveVideoContext(
  userId: string,
  options?: { onCloseGallery?: (mediaIndex: number) => void }
) {
  const { toggleLikePost } = useFeedLike(userId);
  const postReaction = usePostReaction(userId);
  const { openShare } = useSharePost(userId);
  const { openPostActions } = usePostActions({
    userId,
    onShareInApp: (target) => openShare(target.shared_post ?? target),
  });
  const { toggleFollow, isFollowing } = useSuggestedFollow(userId);

  return useCallback(
    (post: Post): ImmersiveVideoGalleryContext | undefined => {
      if (!usesMobileWebCommentsRoute()) return undefined;
      const displayPost = post.shared_post ?? post;
      const authorId = post.author?.id;
      const showFollow = Boolean(authorId && authorId !== userId && !isFollowing(authorId));
      return {
        postActions: {
          post,
          onLike: () => toggleLikePost(post.id),
          onRespect: () =>
            postReaction.mutate({
              postId: post.id,
              emoji: STRONG_WORK_EMOJI,
              currentEmoji: post.my_reaction,
            }),
          onComment: (playback, draft) => {
            options?.onCloseGallery?.(playback.mediaIndex);
            navigateToPostCommentsFromVideoViewer(
              post,
              playback,
              displayPost.media_urls ?? [],
              {
                draft,
                thumbnailUrl: displayPost.thumbnail_url,
                postType: displayPost.post_type,
              }
            );
          },
          onShare: () => openShare(post.shared_post ?? post),
          onMore: () => openPostActions(post),
          onAuthorPress: () => {
            if (post.author?.username) pushScreen(`/user/${post.author.username}`);
          },
          onFollow: authorId ? () => toggleFollow(authorId) : undefined,
          showFollow,
        },
      };
    },
    [
      isFollowing,
      openPostActions,
      openShare,
      options?.onCloseGallery,
      postReaction,
      toggleFollow,
      toggleLikePost,
      userId,
    ]
  );
}
