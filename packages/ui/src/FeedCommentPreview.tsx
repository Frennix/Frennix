import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Comment } from "@frennix/types";
import { colors, spacing, typography } from "./theme";

interface FeedCommentPreviewProps {
  comments?: Comment[];
  commentCount?: number;
  onCommentPress?: () => void;
  onViewAllPress?: () => void;
  onAuthorPress?: (username: string) => void;
}

export function FeedCommentPreview({
  comments = [],
  commentCount = 0,
  onCommentPress,
  onViewAllPress,
  onAuthorPress,
}: FeedCommentPreviewProps) {
  const total = Math.max(commentCount, comments.length);
  const showViewAll = total > 2;
  const openComments = onViewAllPress ?? onCommentPress;

  return (
    <View style={styles.container}>
      {showViewAll ? (
        <Pressable onPress={openComments} accessibilityRole="button" accessibilityLabel="View all comments">
          <Text style={styles.viewAll}>View all comments</Text>
        </Pressable>
      ) : null}

      {comments.map((comment) => {
        const username = comment.author?.username ?? "user";
        return (
          <Pressable
            key={comment.id}
            onPress={onCommentPress}
            style={styles.commentRow}
            accessibilityRole="button"
            accessibilityLabel={`Comment by ${username}`}
          >
            <Text style={styles.commentText} numberOfLines={3}>
              <Text
                style={styles.author}
                onPress={
                  onAuthorPress && comment.author?.username
                    ? () => onAuthorPress(comment.author!.username)
                    : undefined
                }
              >
                {username}
              </Text>
              <Text style={styles.commentBody}> {comment.content}</Text>
            </Text>
          </Pressable>
        );
      })}

      {onCommentPress ? (
        <Pressable onPress={onCommentPress} accessibilityRole="button" accessibilityLabel="Add a comment">
          <Text style={styles.addComment}>Add a comment…</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  commentRow: {
    paddingVertical: 1,
  },
  commentText: {
    ...typography.bodySmall,
    lineHeight: 18,
  },
  author: {
    fontWeight: "700",
    color: colors.text,
  },
  commentBody: {
    color: colors.text,
    fontWeight: "400",
  },
  viewAll: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontWeight: "600",
    marginBottom: 2,
  },
  addComment: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginTop: 2,
  },
});
