import { useCallback, useState } from "react";
import type { Post } from "@frennix/types";
import { PostViewerActionSheet } from "@/components/PostViewerActionSheet";
import { copyPostLink, sharePostLink } from "@/lib/post-link";
import { getSharedPostTargetId } from "@frennix/ui";

interface UsePostViewerActionsOptions {
  userId: string;
  onShare?: (post: Post) => void;
  onReport: (postId: string, authorId: string) => void;
}

export function usePostViewerActions({ userId, onShare, onReport }: UsePostViewerActionsOptions) {
  const [activePost, setActivePost] = useState<Post | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  const openViewerActions = useCallback(
    (post: Post) => {
      if (!userId || post.author_id === userId) return;
      setActivePost(post);
      setSheetVisible(true);
    },
    [userId]
  );

  const closeActions = useCallback(() => {
    setSheetVisible(false);
    setActivePost(null);
  }, []);

  const handleShare = useCallback(async () => {
    if (!activePost) return;
    const target = activePost.shared_post ?? activePost;
    const postId = getSharedPostTargetId(activePost);
    closeActions();

    if (onShare) {
      onShare(activePost);
      return;
    }

    await sharePostLink(postId, target.content);
  }, [activePost, closeActions, onShare]);

  const handleCopyLink = useCallback(async () => {
    if (!activePost) return;
    const postId = getSharedPostTargetId(activePost);
    closeActions();
    await copyPostLink(postId);
  }, [activePost, closeActions]);

  const handleReport = useCallback(() => {
    if (!activePost) return;
    const postId = activePost.id;
    const authorId = activePost.author_id;
    closeActions();
    onReport(postId, authorId);
  }, [activePost, closeActions, onReport]);

  const viewerActionSheet = (
    <PostViewerActionSheet
      visible={sheetVisible}
      onClose={closeActions}
      onShare={handleShare}
      onCopyLink={handleCopyLink}
      onReport={handleReport}
    />
  );

  return { openViewerActions, viewerActionSheet };
}
