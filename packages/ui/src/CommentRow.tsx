import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Comment } from "@frennix/types";
import { Avatar } from "./Avatar";
import { formatRelativeTime } from "./formatRelativeTime";
import { colors, radius, spacing, typography } from "./theme";

interface CommentRowProps {
  comment: Comment;
  currentUserId?: string;
  depth?: number;
  onReply: (comment: Comment) => void;
  onLike: (comment: Comment) => void;
  onDelete: (comment: Comment) => void;
  onReport?: (comment: Comment) => void;
}

export function CommentRow({
  comment,
  currentUserId,
  depth = 0,
  onReply,
  onLike,
  onDelete,
  onReport,
}: CommentRowProps) {
  const isOwn = Boolean(currentUserId && comment.author_id === currentUserId);
  const likeCount = comment.like_count ?? 0;

  return (
    <View style={[styles.wrapper, depth > 0 && styles.replyWrapper]}>
      <View style={styles.row}>
        <Avatar uri={comment.author?.avatar_url} name={comment.author?.display_name} size={depth > 0 ? 28 : 36} />
        <View style={styles.body}>
          <View style={styles.meta}>
            <Text style={styles.author}>{comment.author?.display_name ?? "Unknown"}</Text>
            <Text style={styles.time}>{formatRelativeTime(comment.created_at)}</Text>
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
            {isOwn ? (
              <Pressable onPress={() => onDelete(comment)} hitSlop={8} style={styles.actionButton}>
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            ) : onReport ? (
              <Pressable onPress={() => onReport(comment)} hitSlop={8} style={styles.actionButton}>
                <Text style={styles.reportText}>Report</Text>
              </Pressable>
            ) : null}
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
              onReply={onReply}
              onLike={onLike}
              onDelete={onDelete}
              onReport={onReport}
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
  row: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  body: { flex: 1, gap: spacing.xs },
  meta: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  author: { ...typography.bodySmall, fontWeight: "600", color: colors.text },
  time: { ...typography.caption, color: colors.textMuted },
  content: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: 2 },
  actionButton: { paddingVertical: 2 },
  actionText: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
  likedText: { color: colors.accent },
  deleteText: { ...typography.caption, color: colors.danger, fontWeight: "600" },
  reportText: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
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
  onReply: (comment: Comment) => void;
  onLike: (comment: Comment) => void;
  onDelete: (comment: Comment) => void;
  onReport?: (comment: Comment) => void;
}

export function CommentThread({ comments, currentUserId, onReply, onLike, onDelete, onReport }: CommentThreadProps) {
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
          onReply={onReply}
          onLike={onLike}
          onDelete={onDelete}
          onReport={onReport}
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
