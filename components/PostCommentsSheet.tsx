import { useEffect } from "react";
import { Platform } from "react-native";
import { CommentsBottomSheet, type CommentsSheetPresentation } from "@/components/CommentsBottomSheet";
import { usePostCommentsContent } from "@/components/PostCommentsContent";
import { VideoOverlayWebComposerPortal } from "@/components/VideoOverlayWebComposerPortal";
import { restoreWebDocumentScrollLock } from "@/lib/web-modal-scroll-lock";
import { restoreWebHorizontalScrollPosition } from "@/lib/web-horizontal-scroll-restore";
import type { Post } from "@frennix/types";

type PostCommentsSheetProps = {
  visible: boolean;
  post: Post | null;
  userId: string;
  authorProfile?: Post["author"];
  initialDraft?: string;
  onClose: () => void;
  presentation?: CommentsSheetPresentation;
};

export function PostCommentsSheet({
  visible,
  post,
  userId,
  authorProfile,
  initialDraft,
  onClose,
  presentation = "fullscreen",
}: PostCommentsSheetProps) {
  useEffect(() => {
    if (Platform.OS !== "web" || visible) return;
    restoreWebHorizontalScrollPosition();
    restoreWebDocumentScrollLock();
  }, [visible]);

  if (!post) {
    return null;
  }

  return (
    <PostCommentsSheetBody
      visible={visible}
      post={post}
      userId={userId}
      authorProfile={authorProfile}
      initialDraft={initialDraft}
      onClose={onClose}
      presentation={presentation}
    />
  );
}

function PostCommentsSheetBody({
  visible,
  post,
  userId,
  authorProfile,
  initialDraft,
  onClose,
  presentation,
}: PostCommentsSheetProps & { post: Post; visible: boolean }) {
  const { postId, title, commentActionSheets, composer, thread, videoOverlayWebComposer } =
    usePostCommentsContent({
    post,
    userId,
    authorProfile,
    initialDraft,
    enabled: visible,
    rootPortal: true,
    trackInputZoom: Platform.OS === "web",
    compactComposer: presentation === "videoOverlay",
    useVideoOverlayWebComposer: Platform.OS === "web" && presentation === "videoOverlay",
  });

  const showVideoOverlayPortal =
    Platform.OS === "web" && presentation === "videoOverlay" && visible;

  useEffect(() => {
    if (Platform.OS !== "web" || visible) return;
    restoreWebDocumentScrollLock();
  }, [visible]);

  return (
    <>
      {commentActionSheets}
      {showVideoOverlayPortal && videoOverlayWebComposer ? (
        <VideoOverlayWebComposerPortal {...videoOverlayWebComposer} />
      ) : null}
      <CommentsBottomSheet
        visible={visible}
        onClose={onClose}
        postId={postId}
        title={title}
        composer={composer}
        presentation={presentation}
        suppressInlineComposer={Platform.OS === "web" && presentation === "videoOverlay"}
      >
        {thread}
      </CommentsBottomSheet>
    </>
  );
}
