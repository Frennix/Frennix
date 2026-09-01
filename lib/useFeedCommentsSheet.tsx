import { useCallback, useMemo, useState, type ReactNode } from "react";
import type { Post } from "@frennix/types";
import { PostCommentsSheet } from "@/components/PostCommentsSheet";
import { logCommentsCloseRequest } from "@/lib/comments-close-diagnostics";
import {
  navigateToPostComments,
  usesMobileWebCommentsRoute,
} from "@/lib/mobile-web-comments-route";
import { hapticLight } from "@/lib/haptics";

type OpenCommentsOptions = {
  draft?: string;
};

type UseFeedCommentsSheetOptions = {
  userId: string;
  authorProfile?: Post["author"];
};

export function useFeedCommentsSheet({ userId, authorProfile }: UseFeedCommentsSheetOptions) {
  const mobileWebRoute = usesMobileWebCommentsRoute();
  const [activePost, setActivePost] = useState<Post | null>(null);
  const [initialDraft, setInitialDraft] = useState<string | undefined>();
  const visible = !mobileWebRoute && activePost != null;

  const openComments = useCallback(
    (post: Post, options?: OpenCommentsOptions) => {
      hapticLight();
      if (navigateToPostComments(post, options?.draft)) return;
      setActivePost(post);
      setInitialDraft(options?.draft);
    },
    []
  );

  const closeComments = useCallback(() => {
    logCommentsCloseRequest("useFeedCommentsSheet.closeComments", "parent-onClose");
    setActivePost(null);
    setInitialDraft(undefined);
  }, []);

  const commentsSheet: ReactNode = mobileWebRoute ? null : (
    <PostCommentsSheet
      visible={visible}
      post={activePost}
      userId={userId}
      authorProfile={authorProfile}
      initialDraft={initialDraft}
      onClose={closeComments}
    />
  );

  return useMemo(
    () => ({
      commentsVisible: visible,
      openComments,
      closeComments,
      commentsSheet,
    }),
    [closeComments, commentsSheet, openComments, visible]
  );
}
