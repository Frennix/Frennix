import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
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
import { Avatar, CommentThread, colors, getSharedPostTargetId, spacing, typography } from "@frennix/ui";

const MIN_COMMENT_INPUT_HEIGHT = 22;
const ESTIMATED_LINE_HEIGHT = 22;
/** Instagram-like cap: grow through ~5 visible lines, then scroll internally. */
const MAX_VISIBLE_LINES = 5;

function computeCommentMaxInputHeight(): number {
  return MAX_VISIBLE_LINES * ESTIMATED_LINE_HEIGHT;
}

function syncWebTextareaHeight(
  textarea: HTMLTextAreaElement,
  maxHeight: number
): number {
  textarea.style.setProperty("height", `${MIN_COMMENT_INPUT_HEIGHT}px`, "important");
  textarea.style.setProperty("overflow-y", "hidden", "important");
  const measured = Math.ceil(textarea.scrollHeight);
  const next = Math.min(Math.max(MIN_COMMENT_INPUT_HEIGHT, measured), maxHeight);
  textarea.style.setProperty("height", `${next}px`, "important");
  textarea.style.setProperty(
    "overflow-y",
    next >= maxHeight - 1 ? "auto" : "hidden",
    "important"
  );
  return next;
}

type WebCommentTextareaProps = {
  value: string;
  placeholder: string;
  inputHeight: number;
  maxHeight: number;
  onChangeText: (text: string) => void;
  onHeightChange: (height: number) => void;
  onFocus?: () => void;
  onBlur?: () => void;
};

function WebCommentTextarea({
  value,
  placeholder,
  inputHeight,
  maxHeight,
  onChangeText,
  onHeightChange,
  onFocus,
  onBlur,
}: WebCommentTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const remeasure = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const next = syncWebTextareaHeight(textarea, maxHeight);
    onHeightChange(next);
    if (textarea.selectionStart === textarea.value.length) {
      textarea.scrollTop = textarea.scrollHeight;
    }
  }, [maxHeight, onHeightChange]);

  useLayoutEffect(() => {
    remeasure();
  }, [value, maxHeight, remeasure]);

  const webInputStyle = StyleSheet.flatten([
    styles.composerInputWeb,
    {
      height: inputHeight,
      maxHeight,
    },
  ]) as React.CSSProperties;

  return React.createElement("textarea", {
    ref: textareaRef,
    value,
    rows: 1,
    wrap: "soft",
    enterKeyHint: "enter",
    inputMode: "text",
    autoComplete: "off",
    autoCorrect: "on",
    spellCheck: true,
    "data-frennix-comment-input": "true",
    placeholder,
    onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChangeText(event.target.value);
      requestAnimationFrame(remeasure);
    },
    onFocus: (event: React.FocusEvent<HTMLTextAreaElement>) => {
      event.target.setAttribute("enterkeyhint", "enter");
      remeasure();
      onFocus?.();
    },
    onBlur: () => {
      onBlur?.();
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== "Enter") return;
      event.stopPropagation();
    },
    style: webInputStyle,
  });
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
  const canPost = Boolean(value.trim()) && !posting;
  const maxInputHeight = computeCommentMaxInputHeight();
  const [inputHeight, setInputHeight] = useState(MIN_COMMENT_INPUT_HEIGHT);

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

  const handleWebHeightChange = useCallback((height: number) => {
    setInputHeight((current) => (current === height ? current : height));
  }, []);

  useEffect(() => {
    if (!value) {
      setInputHeight(MIN_COMMENT_INPUT_HEIGHT);
    }
  }, [value]);

  const inputScrollEnabled = inputHeight >= maxInputHeight - 1;

  return (
    <View style={styles.composerRow}>
      <Avatar uri={avatarUri} name={avatarName} size={32} deferImagePlaceholder />
      <View style={styles.composerField}>
        {Platform.OS === "web" ? (
          <View style={styles.composerInputWrap}>
            <WebCommentTextarea
              value={value}
              placeholder={placeholder}
              inputHeight={inputHeight}
              maxHeight={maxInputHeight}
              onChangeText={onChangeText}
              onHeightChange={handleWebHeightChange}
              onFocus={onComposerFocus}
              onBlur={onComposerBlur}
            />
          </View>
        ) : (
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
        )}
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
};

export type PostCommentsContentResult = {
  postId: string;
  title: string;
  commentActionSheets: ReactNode;
  composer: ReactNode;
  thread: ReactNode;
};

export function usePostCommentsContent({
  post,
  userId,
  authorProfile,
  initialDraft,
  enabled = true,
  rootPortal = false,
  trackInputZoom = false,
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

  const composer = (
    <>
      {replyTo ? (
        <View style={styles.replyBanner}>
          <Text style={styles.replyBannerText} numberOfLines={1}>
            Replying to {replyTo.author?.display_name ?? "comment"}
          </Text>
          <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
            <Text style={styles.replyCancel}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}
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
      />
    </>
  );

  const thread = (
    <CommentThread
      comments={comments}
      currentUserId={userId}
      onReply={setReplyTo}
      onLike={(comment) =>
        commentLikeMutation.mutate({ commentId: comment.id, liked: !!comment.liked_by_me })
      }
      onMenuPress={openCommentActions}
    />
  );

  return {
    postId,
    title,
    commentActionSheets,
    composer,
    thread,
  };
}

const styles = StyleSheet.create({
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  composerField: {
    flex: 1,
    minHeight: 40,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    paddingVertical: Platform.OS === "web" ? 8 : 6,
  },
  composerInputWrap: {
    flex: 1,
    minWidth: 0,
  },
  composerInput: {
    flex: 1,
    flexShrink: 1,
    minHeight: MIN_COMMENT_INPUT_HEIGHT,
    paddingVertical: 0,
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
    margin: 0,
    paddingVertical: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    resize: "none",
    overflowY: "hidden",
    boxSizing: "border-box",
    outlineStyle: "none",
    WebkitTextFillColor: colors.text,
    caretColor: colors.text,
  },
  postButton: {
    minWidth: 44,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xxs,
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
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
  },
  replyBannerText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  replyCancel: { ...typography.caption, color: colors.accent, fontWeight: "600" },
});
