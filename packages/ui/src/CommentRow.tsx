import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Comment } from "@frennix/types";
import { Avatar } from "./Avatar";
import { formatRelativeTime } from "./formatRelativeTime";
import { MenuIconButton } from "./MenuIconButton";
import { colors, radius, spacing, typography } from "./theme";

interface CommentRowProps {
  comment: Comment;
  currentUserId?: string;
  depth?: number;
  highlightCommentId?: string;
  onHighlightLayout?: (y: number) => void;
  onReply: (comment: Comment) => void;
  onLike: (comment: Comment) => void;
  onMenuPress?: (comment: Comment) => void;
}

export function CommentRow({
  comment,
  currentUserId,
  depth = 0,
  highlightCommentId,
  onHighlightLayout,
  onReply,
  onLike,
  onMenuPress,
}: CommentRowProps) {
  const likeCount = comment.like_count ?? 0;
  const showMenu = Boolean(currentUserId && onMenuPress);
  const highlighted = highlightCommentId === comment.id;

  return (
    <View
      style={[styles.wrapper, depth > 0 && styles.replyWrapper, highlighted && styles.highlighted]}
      onLayout={
        highlighted && onHighlightLayout
          ? (event) => onHighlightLayout(event.nativeEvent.layout.y)
          : undefined
      }
    >
      <View style={styles.row}>
        <Avatar uri={comment.author?.avatar_url} name={comment.author?.display_name} size={depth > 0 ? 28 : 36} />
        <View style={styles.body}>
          <View style={styles.metaRow}>
            <View style={styles.meta}>
              <Text style={styles.author}>{comment.author?.display_name ?? "Unknown"}</Text>
              <Text style={styles.time}>{formatRelativeTime(comment.created_at)}</Text>
            </View>
            {showMenu ? (
              <MenuIconButton
                compact
                onPress={() => onMenuPress?.(comment)}
                accessibilityLabel="Comment options"
              />
            ) : null}
          </View>
          <Text style={styles.content}>{comment.content}</Text>
          <View style={styles.actions}>
            <Pressable onPress={() => onLike(comment)} hitSlop={8} style={styles.actionButton}>
              <Text style={[styles.actionText, comment.liked_by_me && styles.likedText]}>
                {comment.liked_by_me ? "♥" : "♡"} {likeCount > 0 ? likeCount : ""}
              </Text>
            </Pressable>
            <Pressable onPress={() => onReply(comment)} hitSlop={8} style={styles.actionButton}>
              <Text style={styles.actionText}>Reply</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {comment.replies?.length ? (
        <View style={styles.replies}>
          {comment.replies.map((reply) => (
            <CommentRow
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              depth={depth + 1}
              highlightCommentId={highlightCommentId}
              onHighlightLayout={onHighlightLayout}
              onReply={onReply}
              onLike={onLike}
              onMenuPress={onMenuPress}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  replyWrapper: { marginLeft: spacing.lg },
  highlighted: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginHorizontal: -spacing.sm,
  },
  row: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  body: { flex: 1, gap: spacing.xs },
  metaRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm },
  meta: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  author: { ...typography.bodySmall, fontWeight: "600", color: colors.text },
  time: { ...typography.caption, color: colors.textMuted },
  content: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: 2 },
  actionButton: { paddingVertical: 2 },
  actionText: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
  likedText: { color: colors.accent },
  replies: {
    marginTop: spacing.sm,
    paddingLeft: spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
  },
});

interface CommentThreadProps {
  comments: Comment[];
  currentUserId?: string;
  highlightCommentId?: string;
  onHighlightLayout?: (y: number) => void;
  onReply: (comment: Comment) => void;
  onLike: (comment: Comment) => void;
  onMenuPress?: (comment: Comment) => void;
}

export function CommentThread({
  comments,
  currentUserId,
  highlightCommentId,
  onHighlightLayout,
  onReply,
  onLike,
  onMenuPress,
}: CommentThreadProps) {
  if (!comments.length) {
    return (
      <View style={threadStyles.empty}>
        <Text style={threadStyles.emptyText}>No comments yet. Start the conversation.</Text>
      </View>
    );
  }

  return (
    <View style={threadStyles.list}>
      {comments.map((comment) => (
        <CommentRow
          key={comment.id}
          comment={comment}
          currentUserId={currentUserId}
          highlightCommentId={highlightCommentId}
          onHighlightLayout={onHighlightLayout}
          onReply={onReply}
          onLike={onLike}
          onMenuPress={onMenuPress}
        />
      ))}
    </View>
  );
}

const threadStyles = StyleSheet.create({
  list: { gap: spacing.xs },
  empty: {
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: { ...typography.bodySmall, color: colors.textMuted, textAlign: "center" },
});
