import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputContentSizeChangeEventData,
} from "react-native";
import { addComment, getComments, toggleCommentLike } from "@frennix/api";
import type { Comment, Post } from "@frennix/types";
import { useCommentActions } from "@/lib/useCommentActions";
import { logCommentsInputZoomSnapshot } from "@/lib/comments-input-zoom-diagnostics";
import { hapticLight } from "@/lib/haptics";
import { WebCommentComposerRow } from "@/components/WebCommentComposerRow";
import { Avatar, CommentThread, colors, getSharedPostTargetId, spacing, typography } from "@frennix/ui";

const MIN_COMMENT_INPUT_HEIGHT = 22;
const ESTIMATED_LINE_HEIGHT = 22;
/** Fixed horizontal slots in the composer row — used to keep Post on-screen. */
const COMPOSER_AVATAR_WIDTH_PX = 32;
const COMPOSER_POST_WIDTH_PX = 48;
const COMPOSER_ROW_GAP_PX = spacing.xs;
/** Instagram-like cap: grow through ~5 visible lines, then scroll internally. */
const MAX_VISIBLE_LINES = 5;
/** Internal textarea inset — included in border-box height/width. */
const COMMENT_TEXTAREA_PADDING_X_PX = 14;
const COMMENT_TEXTAREA_PADDING_Y_PX = 8;
const COMMENT_TEXTAREA_PADDING_TOTAL_Y_PX = COMMENT_TEXTAREA_PADDING_Y_PX * 2;

/** Border-box inset around the textarea inside composerField (1px each side). */
const COMPOSER_FIELD_BORDER_TOTAL_PX = 2;

type WebTextareaVerticalChromePx = {
  paddingTop: number;
  paddingBottom: number;
  borderTop: number;
  borderBottom: number;
};

function computeCommentMinInputHeight(): number {
  return ESTIMATED_LINE_HEIGHT + COMMENT_TEXTAREA_PADDING_TOTAL_Y_PX;
}

function computeCommentMaxInputHeight(): number {
  return MAX_VISIBLE_LINES * ESTIMATED_LINE_HEIGHT + COMMENT_TEXTAREA_PADDING_TOTAL_Y_PX;
}

function readWebTextareaVerticalChromePx(textarea: HTMLTextAreaElement): WebTextareaVerticalChromePx {
  if (typeof window === "undefined") {
    return {
      paddingTop: COMMENT_TEXTAREA_PADDING_Y_PX,
      paddingBottom: COMMENT_TEXTAREA_PADDING_Y_PX,
      borderTop: 0,
      borderBottom: 0,
    };
  }

  const style = window.getComputedStyle(textarea);
  return {
    paddingTop: Number.parseFloat(style.paddingTop) || COMMENT_TEXTAREA_PADDING_Y_PX,
    paddingBottom: Number.parseFloat(style.paddingBottom) || COMMENT_TEXTAREA_PADDING_Y_PX,
    borderTop: Number.parseFloat(style.borderTopWidth) || 0,
    borderBottom: Number.parseFloat(style.borderBottomWidth) || 0,
  };
}

function readWebTextareaLineHeight(textarea: HTMLTextAreaElement): number {
  if (typeof window === "undefined") return ESTIMATED_LINE_HEIGHT;
  const parsed = Number.parseFloat(window.getComputedStyle(textarea).lineHeight);
  return Number.isFinite(parsed) ? parsed : ESTIMATED_LINE_HEIGHT;
}

/** Border-box height for exactly MAX_VISIBLE_LINES complete rows inside the textarea. */
export function computeWebCommentMaxTextareaHeight(textarea: HTMLTextAreaElement): number {
  const lineHeight = readWebTextareaLineHeight(textarea);
  const { paddingTop, paddingBottom, borderTop, borderBottom } =
    readWebTextareaVerticalChromePx(textarea);
  return Math.ceil(
    MAX_VISIBLE_LINES * lineHeight + paddingTop + paddingBottom + borderTop + borderBottom
  );
}

function computeWebCommentMinTextareaHeight(textarea: HTMLTextAreaElement): number {
  const lineHeight = readWebTextareaLineHeight(textarea);
  const { paddingTop, paddingBottom, borderTop, borderBottom } =
    readWebTextareaVerticalChromePx(textarea);
  return Math.ceil(lineHeight + paddingTop + paddingBottom + borderTop + borderBottom);
}

function readComposerFieldVerticalPaddingPx(compactComposer: boolean): number {
  return compactComposer ? 6 : 8;
}

/** Border-box height for the rounded composerField wrapping a textarea of the given outer height. */
export function computeCommentComposerFieldHeight(
  textareaHeight: number,
  compactComposer = false
): number {
  return (
    textareaHeight + readComposerFieldVerticalPaddingPx(compactComposer) + COMPOSER_FIELD_BORDER_TOTAL_PX
  );
}

export function computeCommentMaxComposerFieldHeight(compactComposer = false): number {
  return computeCommentComposerFieldHeight(computeCommentMaxInputHeight(), compactComposer);
}

function appendOptimisticComment(
  comments: Comment[],
  optimistic: Comment,
  parentId: string | null
): Comment[] {
  if (!parentId) return [...comments, optimistic];
  return comments.map((comment) =>
    comment.id === parentId
      ? { ...comment, replies: [...(comment.replies ?? []), optimistic] }
      : comment
  );
}

type CommentComposerRowProps = {
  avatarUri?: string | null;
  avatarName?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  onPost: () => void;
  posting: boolean;
  onComposerFocus?: () => void;
  onComposerBlur?: () => void;
  /** Tighter pill spacing for the immersive video overlay composer. */
  compactComposer?: boolean;
};

export function CommentComposerRow({
  avatarUri,
  avatarName,
  value,
  onChangeText,
  placeholder,
  onPost,
  posting,
  onComposerFocus,
  onComposerBlur,
}: CommentComposerRowProps) {
  if (Platform.OS === "web") {
    return (
      <WebCommentComposerRow
        avatarUri={avatarUri}
        avatarName={avatarName}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        onPost={onPost}
        posting={posting}
        onFocus={onComposerFocus}
        onBlur={onComposerBlur}
      />
    );
  }

  const canPost = Boolean(value.trim()) && !posting;
  const minInputHeight = computeCommentMinInputHeight();
  const maxInputHeight = computeCommentMaxInputHeight();
  const prevValueLengthRef = useRef(0);
  const [inputHeight, setInputHeight] = useState(minInputHeight);

  const handleNativeContentSizeChange = useCallback(
    (event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
      const contentHeight = event.nativeEvent.contentSize.height;
      const nextHeight = Math.min(
        Math.max(MIN_COMMENT_INPUT_HEIGHT, Math.ceil(contentHeight)),
        maxInputHeight
      );
      setInputHeight((current) => (current === nextHeight ? current : nextHeight));
    },
    [maxInputHeight]
  );

  useEffect(() => {
    if (!value) {
      prevValueLengthRef.current = 0;
      setInputHeight(minInputHeight);
    }
  }, [minInputHeight, value]);

  const inputScrollEnabled = inputHeight >= maxInputHeight - 1;

  return (
    <View style={styles.composerRow}>
      <View style={styles.composerAvatarSlot}>
        <Avatar uri={avatarUri} name={avatarName} size={COMPOSER_AVATAR_WIDTH_PX} deferImagePlaceholder />
      </View>
      <View style={styles.composerField}>
        <View style={styles.composerInputWrap}>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            onContentSizeChange={handleNativeContentSizeChange}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            style={[
              styles.composerInput,
              {
                height: Math.max(MIN_COMMENT_INPUT_HEIGHT, inputHeight),
                maxHeight: maxInputHeight,
              },
            ]}
            multiline
            scrollEnabled={inputScrollEnabled}
            maxLength={2000}
            blurOnSubmit={false}
            returnKeyType="default"
            textAlignVertical="top"
            onFocus={onComposerFocus}
            onBlur={onComposerBlur}
          />
        </View>
      </View>
      <Pressable
        onPress={onPost}
        disabled={!canPost}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Post comment"
        style={styles.postButton}
      >
        {posting ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <Text style={[styles.postLabel, !canPost && styles.postLabelDisabled]}>Post</Text>
        )}
      </Pressable>
    </View>
  );
}

type UsePostCommentsContentOptions = {
  post: Post;
  userId: string;
  authorProfile?: Post["author"];
  initialDraft?: string;
  enabled?: boolean;
  /** Comment options render in a root portal (required on the dedicated comments route). */
  rootPortal?: boolean;
  trackInputZoom?: boolean;
  /** Tighter pill spacing for the immersive video overlay composer. */
  compactComposer?: boolean;
  /** Web video overlay uses the portaled composer instead of inline sheet chrome. */
  useVideoOverlayWebComposer?: boolean;
};

export type VideoOverlayWebComposerModel = {
  value: string;
  placeholder: string;
  avatarUri?: string | null;
  avatarName?: string;
  posting: boolean;
  onChangeText: (text: string) => void;
  onPost: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
};

export type PostCommentsContentResult = {
  postId: string;
  title: string;
  commentActionSheets: ReactNode;
  composer: ReactNode;
  thread: ReactNode;
  videoOverlayWebComposer: VideoOverlayWebComposerModel | null;
};

export function usePostCommentsContent({
  post,
  userId,
  authorProfile,
  initialDraft,
  enabled = true,
  rootPortal = false,
  trackInputZoom = false,
  compactComposer = false,
  useVideoOverlayWebComposer: useVideoOverlayWebComposerOption = false,
}: UsePostCommentsContentOptions): PostCommentsContentResult {
  const postId = getSharedPostTargetId(post);
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const commentsOpenLoggedRef = useRef(false);

  const handleComposerFocus = useCallback(() => {
    if (!trackInputZoom || Platform.OS !== "web") return;
    logCommentsInputZoomSnapshot("after-focus");
  }, [trackInputZoom]);

  const handleComposerBlur = useCallback(() => {
    if (!trackInputZoom || Platform.OS !== "web") return;
    logCommentsInputZoomSnapshot("after-blur");
  }, [trackInputZoom]);

  useEffect(() => {
    if (!trackInputZoom || Platform.OS !== "web") return;

    if (enabled && !commentsOpenLoggedRef.current) {
      commentsOpenLoggedRef.current = true;
      logCommentsInputZoomSnapshot("before-focus");
      return;
    }

    if (!enabled && commentsOpenLoggedRef.current) {
      commentsOpenLoggedRef.current = false;
      logCommentsInputZoomSnapshot("after-comments-close");
    }
  }, [enabled, trackInputZoom]);

  const { openCommentActions, commentActionSheets, resetCommentActions } = useCommentActions({
    userId,
    postId,
    rootPortal,
    onDeleted: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", postId] });
      queryClient.invalidateQueries({ queryKey: ["post", postId] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["comments", postId, userId],
    queryFn: () => getComments(postId, userId),
    enabled: enabled && !!postId && !!userId,
  });

  useEffect(() => {
    if (!enabled) {
      setCommentText("");
      setReplyTo(null);
      resetCommentActions();
      return;
    }
    if (initialDraft) {
      setCommentText(initialDraft);
    }
  }, [enabled, initialDraft, resetCommentActions]);

  const invalidatePostComments = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["comments", postId] });
    queryClient.invalidateQueries({ queryKey: ["post", postId] });
    queryClient.invalidateQueries({ queryKey: ["feed"] });
  }, [postId, queryClient]);

  type CommentMutationVars = {
    text: string;
    parentId: string | null;
    replyToComment: Comment | null;
  };

  const commentMutation = useMutation({
    mutationFn: ({ text, parentId }: CommentMutationVars) =>
      addComment(postId, userId, text, parentId),
    onMutate: async ({ text, parentId, replyToComment }) => {
      hapticLight();
      const optimistic: Comment = {
        id: `optimistic-${Date.now()}`,
        post_id: postId,
        author_id: userId,
        parent_id: parentId,
        content: text,
        created_at: new Date().toISOString(),
        author: authorProfile ?? undefined,
        like_count: 0,
        liked_by_me: false,
        replies: [],
      };

      await queryClient.cancelQueries({ queryKey: ["comments", postId, userId] });

      const previousComments = queryClient.getQueryData<Comment[]>(["comments", postId, userId]);

      queryClient.setQueryData<Comment[]>(["comments", postId, userId], (old = []) =>
        appendOptimisticComment(old, optimistic, parentId)
      );

      setCommentText("");
      setReplyTo(null);

      return { previousComments, replyToComment };
    },
    onError: (_error, { text, replyToComment }, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(["comments", postId, userId], context.previousComments);
      }
      setCommentText(text);
      if (replyToComment) setReplyTo(replyToComment);
    },
    onSettled: () => {
      invalidatePostComments();
    },
  });

  const commentLikeMutation = useMutation({
    mutationFn: ({ commentId, liked }: { commentId: string; liked: boolean }) =>
      toggleCommentLike(commentId, userId, liked),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", postId] });
    },
  });

  const commentPlaceholder = replyTo
    ? `Reply to ${replyTo.author?.display_name ?? "comment"}…`
    : "Add a comment…";

  const title = post.comment_count ? `Comments (${post.comment_count})` : "Comments";

  const handlePost = useCallback(() => {
    const text = commentText.trim();
    if (!text) return;
    commentMutation.mutate({
      text,
      parentId: replyTo?.id ?? null,
      replyToComment: replyTo,
    });
  }, [commentMutation, commentText, replyTo]);

  const useVideoOverlayWebComposer =
    useVideoOverlayWebComposerOption || (compactComposer && Platform.OS === "web");

  const replyBanner = replyTo ? (
    <View style={styles.replyBanner}>
      <Text style={styles.replyBannerText} numberOfLines={1}>
        Replying to {replyTo.author?.display_name ?? "comment"}
      </Text>
      <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
        <Text style={styles.replyCancel}>Cancel</Text>
      </Pressable>
    </View>
  ) : null;

  const composer = useVideoOverlayWebComposer ? null : (
    <>
      {replyBanner}
      <CommentComposerRow
        avatarUri={authorProfile?.avatar_url}
        avatarName={authorProfile?.display_name}
        value={commentText}
        onChangeText={setCommentText}
        placeholder={commentPlaceholder}
        onPost={handlePost}
        posting={commentMutation.isPending}
        onComposerFocus={handleComposerFocus}
        onComposerBlur={handleComposerBlur}
        compactComposer={compactComposer}
      />
    </>
  );

  const videoOverlayWebComposer: VideoOverlayWebComposerModel | null = useVideoOverlayWebComposer
    ? {
        value: commentText,
        placeholder: commentPlaceholder,
        avatarUri: authorProfile?.avatar_url,
        avatarName: authorProfile?.display_name,
        posting: commentMutation.isPending,
        onChangeText: setCommentText,
        onPost: handlePost,
        onFocus: handleComposerFocus,
        onBlur: handleComposerBlur,
      }
    : null;

  const thread = (
    <>
      {useVideoOverlayWebComposer ? replyBanner : null}
      <CommentThread
        comments={comments}
        currentUserId={userId}
        onReply={setReplyTo}
        onLike={(comment) =>
          commentLikeMutation.mutate({ commentId: comment.id, liked: !!comment.liked_by_me })
        }
        onMenuPress={openCommentActions}
      />
    </>
  );

  return {
    postId,
    title,
    commentActionSheets,
    composer,
    thread,
    videoOverlayWebComposer,
  };
}

const styles = StyleSheet.create({
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: COMPOSER_ROW_GAP_PX,
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    flexShrink: 0,
    ...(Platform.OS === "web"
      ? ({
          boxSizing: "border-box",
        } as const)
      : null),
  },
  composerRowCompact: {
    alignItems: "center",
  },
  composerAvatarSlot: {
    width: COMPOSER_AVATAR_WIDTH_PX,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  composerField: {
    flex: 1,
    minWidth: 0,
    maxWidth: "100%",
    minHeight: 34,
    flexShrink: Platform.OS === "web" ? 0 : 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: Platform.OS === "web" ? 4 : 3,
    ...(Platform.OS === "web"
      ? ({
          boxSizing: "border-box",
        } as const)
      : null),
  },
  composerFieldCompact: {
    minHeight: 32,
    paddingVertical: 3,
  },
  composerInputWrap: {
    width: "100%",
    minWidth: 0,
    flexShrink: 0,
    ...(Platform.OS === "web"
      ? ({
          overflowX: "hidden",
          overflowY: "visible",
          boxSizing: "border-box",
        } as const)
      : null),
  },
  composerInput: {
    width: "100%",
    minWidth: 0,
    flexShrink: 1,
    minHeight: MIN_COMMENT_INPUT_HEIGHT,
    maxWidth: "100%",
    paddingVertical: COMMENT_TEXTAREA_PADDING_Y_PX,
    paddingHorizontal: COMMENT_TEXTAREA_PADDING_X_PX,
    color: colors.text,
    fontSize: Platform.OS === "web" ? 16 : 15,
    lineHeight: Platform.OS === "web" ? 22 : 20,
    ...(Platform.OS === "web"
      ? ({
          outlineStyle: "none",
          WebkitTextFillColor: colors.text,
          caretColor: colors.text,
        } as object)
      : null),
  },
  composerInputWeb: {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    margin: 0,
    paddingTop: COMMENT_TEXTAREA_PADDING_Y_PX,
    paddingBottom: COMMENT_TEXTAREA_PADDING_Y_PX,
    paddingLeft: COMMENT_TEXTAREA_PADDING_X_PX,
    paddingRight: COMMENT_TEXTAREA_PADDING_X_PX,
    borderWidth: 0,
    backgroundColor: "transparent",
    ...(Platform.OS === "web"
      ? ({
          boxShadow: "none",
        } as object)
      : null),
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    resize: "none",
    overflowX: "hidden",
    overflowY: "hidden",
    boxSizing: "border-box",
    display: "block",
    textIndent: 0,
    outlineStyle: "none",
    WebkitTextFillColor: colors.text,
    caretColor: colors.text,
    ...(Platform.OS === "web"
      ? ({
          WebkitAppearance: "none",
          appearance: "none",
        } as object)
      : null),
  },
  postButton: {
    width: COMPOSER_POST_WIDTH_PX,
    flexShrink: 0,
    minHeight: 28,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 0,
    marginBottom: Platform.OS === "web" ? 1 : 0,
  },
  postButtonCompact: {
    minHeight: 26,
    marginBottom: 0,
  },
  postLabel: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: "700",
  },
  postLabelDisabled: {
    color: colors.textMuted,
    opacity: 0.55,
  },
  replyBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
  },
  replyBannerText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  replyCancel: { ...typography.caption, color: colors.accent, fontWeight: "600" },
});
