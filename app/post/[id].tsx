import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import {
  addComment,
  getComments,
  getPost,
  toggleCommentLike,
} from "@frennix/api";
import type { Comment, Post } from "@frennix/types";
import { useAuth } from "@/providers/AuthProvider";
import { usePostActions } from "@/lib/usePostActions";
import { useCommentActions } from "@/lib/useCommentActions";
import { useSharePost } from "@/lib/useSharePost";
import { useSavePost } from "@/lib/useSavePost";
import { usePostReaction } from "@/lib/usePostReaction";
import { useFeedLike } from "@/lib/useFeedLike";
import { hapticLight } from "@/lib/haptics";
import { DetailLoading } from "@/components/DetailLoading";
import { useCallback, useRef, useState } from "react";
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
  const { id, comment: commentParam } = useLocalSearchParams<{ id: string; comment?: string }>();
  const highlightCommentId = Array.isArray(commentParam) ? commentParam[0] : commentParam;
  const { session, profile } = useAuth();
  const userId = session?.user.id ?? "";
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const queryClient = useQueryClient();
  const scrollRef = useRef<ScrollView>(null);
  const scrolledToCommentRef = useRef(false);

  const handleHighlightLayout = useCallback(
    (y: number) => {
      if (!highlightCommentId || scrolledToCommentRef.current) return;
      scrolledToCommentRef.current = true;
      scrollRef.current?.scrollTo({ y: Math.max(0, y - spacing.md), animated: true });
    },
    [highlightCommentId]
  );

  const invalidatePostComments = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["comments", id] });
    queryClient.invalidateQueries({ queryKey: ["post", id] });
    queryClient.invalidateQueries({ queryKey: ["feed"] });
  }, [id, queryClient]);

  const { openShare, shareSheet } = useSharePost(userId);
  const { openPostActions, postActionSheets } = usePostActions({
    userId,
    onDeleted: () => router.back(),
    onShareInApp: (selected) => openShare(selected.shared_post ?? selected),
  });
  const { toggleSavePost } = useSavePost(userId);
  const postReaction = usePostReaction(userId);
  const { openCommentActions, commentActionSheets } = useCommentActions({
    userId,
    postId: id!,
    onDeleted: invalidatePostComments,
  });
  const { toggleLikePost } = useFeedLike(userId);

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

  const { openGallery, lightbox } = useImageLightbox();
  const [mediaPageIndex, setMediaPageIndex] = useState(0);

  type CommentMutationVars = {
    text: string;
    parentId: string | null;
    replyToComment: Comment | null;
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

  const commentMutation = useMutation({
    mutationFn: ({ text, parentId }: CommentMutationVars) =>
      addComment(id!, userId, text, parentId),
    onMutate: async ({ text, parentId, replyToComment }) => {
      hapticLight();
      const optimistic: Comment = {
        id: `optimistic-${Date.now()}`,
        post_id: id!,
        author_id: userId,
        parent_id: parentId,
        content: text,
        created_at: new Date().toISOString(),
        author: profile ?? undefined,
        like_count: 0,
        liked_by_me: false,
        replies: [],
      };

      await queryClient.cancelQueries({ queryKey: ["comments", id, userId] });
      await queryClient.cancelQueries({ queryKey: ["post", id, userId] });

      const previousComments = queryClient.getQueryData<Comment[]>(["comments", id, userId]);
      const previousPost = queryClient.getQueryData<Post>(["post", id, userId]);

      queryClient.setQueryData<Comment[]>(["comments", id, userId], (old = []) =>
        appendOptimisticComment(old, optimistic, parentId)
      );

      if (previousPost) {
        queryClient.setQueryData<Post>(["post", id, userId], {
          ...previousPost,
          comment_count: (previousPost.comment_count ?? 0) + 1,
        });
      }

      setCommentText("");
      setReplyTo(null);

      return { previousComments, previousPost, replyToComment };
    },
    onError: (_error, { text, replyToComment }, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(["comments", id, userId], context.previousComments);
      }
      if (context?.previousPost) {
        queryClient.setQueryData(["post", id, userId], context.previousPost);
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["comments", id] }),
  });

  function handleReply(comment: Comment) {
    setReplyTo(comment);
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
      {postActionSheets}
      {commentActionSheets}
      {shareSheet}
      {lightbox}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <PostCard
          post={post}
          isOwn={post.author_id === userId}
          onOwnerActionsPress={() => openPostActions(post)}
          onMediaPress={(uri, index) => {
            const displayPost = post.shared_post ?? post;
            setMediaPageIndex(index);
            openGallery(displayPost.media_urls ?? [uri], index, setMediaPageIndex, {
              postType: displayPost.post_type,
              thumbnailUrl: displayPost.thumbnail_url,
            });
          }}
          mediaPageIndex={mediaPageIndex}
          onMediaPageIndexChange={setMediaPageIndex}
          onPress={() => {
            const targetId = getSharedPostTargetId(post);
            if (targetId !== post.id) router.push(`/post/${targetId}`);
          }}
          onLike={() => toggleLikePost(post.id)}
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
          onModerationPress={() => openPostActions(post)}
        />

        <Text style={styles.section}>
          Comments {post.comment_count ? `(${post.comment_count})` : ""}
        </Text>

        <CommentThread
          comments={comments}
          currentUserId={userId}
          highlightCommentId={highlightCommentId}
          onHighlightLayout={handleHighlightLayout}
          onReply={handleReply}
          onLike={handleLike}
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
            if (!text) return;
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
