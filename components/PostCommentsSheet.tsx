import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { addComment, getComments, toggleCommentLike } from "@frennix/api";
import type { Comment, Post } from "@frennix/types";
import { BottomActionSheet } from "@/components/BottomActionSheet";
import { useCommentActions } from "@/lib/useCommentActions";
import { hapticLight } from "@/lib/haptics";
import { Button, CommentThread, Input, colors, getSharedPostTargetId, spacing, typography } from "@frennix/ui";

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

  const { openCommentActions, commentActionSheets } = useCommentActions({
    userId,
    postId: postId ?? "",
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
      return;
    }
    if (initialDraft) {
      setCommentText(initialDraft);
    }
  }, [initialDraft, visible]);

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

  const title = post?.comment_count
    ? `Comments (${post.comment_count})`
    : "Comments";

  // Match PostInteractionSheet: on web, do not mount BottomActionSheet while closed.
  // BottomActionSheet early-returns before a useMemo when visible=false on web (React #310).
  if ((Platform.OS === "web" && !visible) || !post) {
    return <>{commentActionSheets}</>;
  }

  return (
    <>
      {commentActionSheets}
      <BottomActionSheet
        visible
        onClose={onClose}
        expanded
        fitToContent={false}
        scrollEnabled={false}
        backdropAccessibilityLabel="Close comments"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.sheetRoot}
        >
          <Text style={styles.title}>{title}</Text>

          <ScrollView
            style={styles.threadScroll}
            contentContainerStyle={styles.threadContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
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
          </ScrollView>

          <View style={styles.composer}>
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
            <Input value={commentText} onChangeText={setCommentText} placeholder={commentPlaceholder} />
            <Button
              title={replyTo ? "Reply" : "Post comment"}
              onPress={() => {
                const text = commentText.trim();
                if (!text || !postId) return;
                commentMutation.mutate({
                  text,
                  parentId: replyTo?.id ?? null,
                  replyToComment: replyTo,
                });
              }}
              loading={commentMutation.isPending}
              disabled={!commentText.trim()}
            />
          </View>
        </KeyboardAvoidingView>
      </BottomActionSheet>
    </>
  );
}

const styles = StyleSheet.create({
  sheetRoot: {
    flexGrow: 1,
    maxHeight: 520,
  },
  title: {
    ...typography.heading,
    fontSize: 18,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  threadScroll: {
    flexGrow: 1,
    flexShrink: 1,
  },
  threadContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  composer: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  replyBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
  },
  replyBannerText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  replyCancel: { ...typography.caption, color: colors.accent, fontWeight: "600" },
});
