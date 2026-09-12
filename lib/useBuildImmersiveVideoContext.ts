import { useCallback, useMemo, type ReactNode } from "react";
import type { Post } from "@frennix/types";
import type { ImmersiveVideoGalleryContext } from "@/lib/immersive-video-gallery";
import { usesMobileWebCommentsRoute } from "@/lib/mobile-web-comments-route";
import { useFeedLike } from "@/lib/useFeedLike";
import { usePostActions } from "@/lib/usePostActions";
import { usePostReaction } from "@/lib/usePostReaction";
import { useSharePost } from "@/lib/useSharePost";
import { useSuggestedFollow } from "@/lib/useSuggestedFollow";
import { pushScreen } from "@/lib/press-utils";

const STRONG_WORK_EMOJI = "💪";

export type BuildImmersiveVideoContextBundle = {
  buildImmersiveContext: (post: Post) => ImmersiveVideoGalleryContext | undefined;
  shareSheet: ReactNode;
  postActionSheets: ReactNode;
  resetOverlayMenus: () => void;
};

type BuildImmersiveVideoContextOptions = {
  onDeleted?: (postId: string) => void;
};

/** Shared post actions for immersive video overlay and /video deep links. */
export function useBuildImmersiveVideoContext(
  userId: string,
  options?: BuildImmersiveVideoContextOptions
): BuildImmersiveVideoContextBundle {
  const { toggleLikePost } = useFeedLike(userId);
  const postReaction = usePostReaction(userId);
  const { openShare, resetShare, shareSheet } = useSharePost(userId);
  const { openPostActions, resetPostActions, postActionSheets } = usePostActions({
    userId,
    onDeleted: options?.onDeleted,
    onShareInApp: (target) => openShare(target.shared_post ?? target),
  });
  const resetOverlayMenus = useCallback(() => {
    resetShare();
    resetPostActions();
  }, [resetPostActions, resetShare]);
  const { toggleFollow, isFollowing } = useSuggestedFollow(userId);

  const buildImmersiveContext = useCallback(
    (post: Post): ImmersiveVideoGalleryContext | undefined => {
      if (!usesMobileWebCommentsRoute()) return undefined;
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
            }),
          onComment: () => {
            /* ImmersiveVideoOverlayShell opens the comments sheet. */
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
      postReaction,
      toggleFollow,
      toggleLikePost,
      userId,
    ]
  );

  return useMemo(
    () => ({
      buildImmersiveContext,
      shareSheet,
      postActionSheets,
      resetOverlayMenus,
    }),
    [buildImmersiveContext, postActionSheets, resetOverlayMenus, shareSheet]
  );
}
