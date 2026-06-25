import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import {
  addComment,
  deleteComment,
  getComments,
  getPost,
  toggleCommentLike,
  toggleLike,
} from "@frennix/api";
import type { Comment } from "@frennix/types";
import { useAuth } from "@/providers/AuthProvider";
import { usePostOwnerActions } from "@/lib/usePostOwnerActions";
import { useSharePost } from "@/lib/useSharePost";
import { useSavePost } from "@/lib/useSavePost";
import { usePostReaction } from "@/lib/usePostReaction";
import { useModeration } from "@/lib/useModeration";
import { PostActionSheet } from "@/components/PostActionSheet";
import { DetailLoading } from "@/components/DetailLoading";
import { useState } from "react";
import { confirmDeleteComment } from "@/lib/alerts";
import { useImageLightbox } from "@/lib/useImageLightbox";
import {
  PostCard,
  Input,
  Button,
  CommentThread,
  EmptyState,
  getSharedPostTargetId,
  colors,
  spacing,
  typography,
} from "@frennix/ui";

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const queryClient = useQueryClient();
  const { openPostActions, actionSheetProps } = usePostOwnerActions({
    userId,
    onDeleted: () => router.back(),
  });
  const { openShare, shareSheet } = useSharePost(userId);
  const { toggleSavePost } = useSavePost(userId);
  const postReaction = usePostReaction(userId);
  const { moderationSheets, openPostModeration, openCommentModeration } = useModeration(userId);
  const { openImage, lightbox } = useImageLightbox();

  const { data: post, isLoading: postLoading } = useQuery({
    queryKey: ["post", id, userId],
    queryFn: () => getPost(id!, userId),
    enabled: !!id && !!userId,
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["comments", id, userId],
    queryFn: () => getComments(id!, userId),
    enabled: !!id && !!userId,
  });

  function invalidatePostComments() {
    queryClient.invalidateQueries({ queryKey: ["comments", id] });
    queryClient.invalidateQueries({ queryKey: ["post", id] });
    queryClient.invalidateQueries({ queryKey: ["feed"] });
  }

  const likeMutation = useMutation({
    mutationFn: () => toggleLike(id!, userId, !!post?.liked_by_me),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["post", id] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });

  const commentMutation = useMutation({
    mutationFn: () => addComment(id!, userId, commentText.trim(), replyTo?.id ?? null),
    onSuccess: () => {
      setCommentText("");
      setReplyTo(null);
      invalidatePostComments();
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => deleteComment(commentId, userId),
    onSuccess: () => invalidatePostComments(),
  });

  const commentLikeMutation = useMutation({
    mutationFn: ({ commentId, liked }: { commentId: string; liked: boolean }) =>
      toggleCommentLike(commentId, userId, liked),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["comments", id] }),
  });

  function handleReply(comment: Comment) {
    setReplyTo(comment);
  }

  function handleDelete(comment: Comment) {
    confirmDeleteComment(() => deleteCommentMutation.mutate(comment.id));
  }

  function handleLike(comment: Comment) {
    commentLikeMutation.mutate({ commentId: comment.id, liked: !!comment.liked_by_me });
  }

  if (postLoading) return <DetailLoading />;
  if (!post) {
    return (
      <View style={styles.notFound}>
        <EmptyState
          title="Post not found"
          description="This post may have been deleted or you don't have access."
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const commentPlaceholder = replyTo
    ? `Reply to ${replyTo.author?.display_name ?? "comment"}…`
    : "Add a comment…";

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={80}
    >
      <PostActionSheet {...actionSheetProps} />
      {shareSheet}
      {moderationSheets}
      {lightbox}
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <PostCard
          post={post}
          isOwn={post.author_id === userId}
          onOwnerActionsPress={() => openPostActions(post)}
          onMediaPress={openImage}
          onPress={() => {
            const targetId = getSharedPostTargetId(post);
            if (targetId !== post.id) router.push(`/post/${targetId}`);
          }}
          onLike={() => likeMutation.mutate()}
          onComment={() => undefined}
          onShare={() => openShare(post.shared_post ?? post)}
          onSave={() => toggleSavePost(post.id, !!post.saved_by_me)}
          onReaction={(emoji) =>
            postReaction.mutate({
              postId: post.id,
              emoji,
              currentEmoji: post.my_reaction,
            })
          }
          onModerationPress={() => openPostModeration(post.id, post.author_id)}
        />

        <Text style={styles.section}>
          Comments {post.comment_count ? `(${post.comment_count})` : ""}
        </Text>

        <CommentThread
          comments={comments}
          currentUserId={userId}
          onReply={handleReply}
          onLike={handleLike}
          onDelete={handleDelete}
          onReport={(comment) => openCommentModeration(comment.id, comment.author_id)}
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
          onPress={() => commentMutation.mutate()}
          loading={commentMutation.isPending}
          disabled={!commentText.trim()}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  section: { ...typography.heading, fontSize: 18, marginTop: spacing.md, marginBottom: spacing.sm },
  composer: {
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
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
  notFound: { flex: 1, backgroundColor: colors.background, justifyContent: "center" },
});
