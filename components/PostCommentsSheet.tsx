import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { addComment, getComments, toggleCommentLike } from "@frennix/api";
import type { Comment, Post } from "@frennix/types";
import { CommentsBottomSheet } from "@/components/CommentsBottomSheet";
import { useCommentActions } from "@/lib/useCommentActions";
import { restoreWebDocumentScrollLock } from "@/lib/web-modal-scroll-lock";
import { hapticLight } from "@/lib/haptics";
import { Avatar, CommentThread, colors, getSharedPostTargetId, spacing, typography } from "@frennix/ui";

type PostCommentsSheetProps = {
  visible: boolean;
  post: Post | null;
  userId: string;
  authorProfile?: Post["author"];
  initialDraft?: string;
  onClose: () => void;
};

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
};

function CommentComposerRow({
  avatarUri,
  avatarName,
  value,
  onChangeText,
  placeholder,
  onPost,
  posting,
}: CommentComposerRowProps) {
  const canPost = Boolean(value.trim()) && !posting;

  return (
    <View style={styles.composerRow}>
      <Avatar uri={avatarUri} name={avatarName} size={32} deferImagePlaceholder />
      <View style={styles.composerField}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          style={styles.composerInput}
          multiline
          maxLength={2000}
          returnKeyType="default"
          blurOnSubmit={false}
          {...(Platform.OS === "web"
            ? ({
                enterKeyHint: "send",
              } as object)
            : null)}
        />
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

export function PostCommentsSheet({
  visible,
  post,
  userId,
  authorProfile,
  initialDraft,
  onClose,
}: PostCommentsSheetProps) {
  const postId = post ? getSharedPostTargetId(post) : null;
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);

  const { openCommentActions, commentActionSheets, resetCommentActions } = useCommentActions({
    userId,
    postId: postId ?? "",
    rootPortal: true,
    onDeleted: () => {
      if (!postId) return;
      queryClient.invalidateQueries({ queryKey: ["comments", postId] });
      queryClient.invalidateQueries({ queryKey: ["post", postId] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["comments", postId, userId],
    queryFn: () => getComments(postId!, userId),
    enabled: visible && !!postId && !!userId,
  });

  useEffect(() => {
    if (!visible) {
      setCommentText("");
      setReplyTo(null);
      resetCommentActions();
      if (Platform.OS === "web") restoreWebDocumentScrollLock();
      return;
    }
    if (initialDraft) {
      setCommentText(initialDraft);
    }
  }, [initialDraft, resetCommentActions, visible]);

  const invalidatePostComments = useCallback(() => {
    if (!postId) return;
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
      addComment(postId!, userId, text, parentId),
    onMutate: async ({ text, parentId, replyToComment }) => {
      if (!postId) return;
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
      if (!postId) return;
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
      if (!postId) return;
      queryClient.invalidateQueries({ queryKey: ["comments", postId] });
    },
  });

  const commentPlaceholder = replyTo
    ? `Reply to ${replyTo.author?.display_name ?? "comment"}…`
    : "Add a comment…";

  const title = post?.comment_count ? `Comments (${post.comment_count})` : "Comments";

  const handlePost = useCallback(() => {
    const text = commentText.trim();
    if (!text || !postId) return;
    commentMutation.mutate({
      text,
      parentId: replyTo?.id ?? null,
      replyToComment: replyTo,
    });
  }, [commentMutation, commentText, postId, replyTo]);

  if (!post) {
    return <>{commentActionSheets}</>;
  }

  return (
    <>
      {commentActionSheets}
      <CommentsBottomSheet
        visible={visible}
        onClose={onClose}
        title={title}
        composer={
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
            />
          </>
        }
      >
        <CommentThread
          comments={comments}
          currentUserId={userId}
          onReply={setReplyTo}
          onLike={(comment) =>
            commentLikeMutation.mutate({ commentId: comment.id, liked: !!comment.liked_by_me })
          }
          onMenuPress={openCommentActions}
        />
      </CommentsBottomSheet>
    </>
  );
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
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    paddingVertical: Platform.OS === "web" ? 8 : 6,
  },
  composerInput: {
    flex: 1,
    minHeight: 24,
    maxHeight: 96,
    paddingVertical: 0,
    paddingHorizontal: 0,
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    backgroundColor: "transparent",
    ...(Platform.OS === "web"
      ? ({
          outlineStyle: "none",
          borderWidth: 0,
          WebkitTextFillColor: colors.text,
          caretColor: colors.text,
          width: "100%",
        } as object)
      : null),
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
