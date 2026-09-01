import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Comment } from "@frennix/types";
import { feedAccessibility, feedLayout, feedLayoutTypography } from "./feed-layout";

interface FeedCommentPreviewProps {
  comments?: Comment[];
  commentCount?: number;
  onCommentPress?: () => void;
  onViewAllPress?: () => void;
  onAuthorPress?: (username: string) => void;
  /** When false, hide the inline "Add a comment…" affordance (modal owns composer). */
  inlineComposerEnabled?: boolean;
}

export function FeedCommentPreview({
  comments = [],
  commentCount = 0,
  onCommentPress,
  onViewAllPress,
  onAuthorPress,
  inlineComposerEnabled = true,
}: FeedCommentPreviewProps) {
  const total = Math.max(commentCount, comments.length);
  const showViewAll = total > 2;
  const openComments = onViewAllPress ?? onCommentPress;

  return (
    <View style={styles.container}>
      {showViewAll ? (
        <Pressable onPress={openComments} accessibilityRole="button" accessibilityLabel="View all comments">
          <Text
            style={styles.viewAll}
            allowFontScaling
            maxFontSizeMultiplier={feedAccessibility.maxFontSizeMultiplier}
          >
            View all comments
          </Text>
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
            <Text
              style={styles.commentText}
              numberOfLines={3}
              allowFontScaling
              maxFontSizeMultiplier={feedAccessibility.maxFontSizeMultiplier}
            >
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

      {onCommentPress && inlineComposerEnabled ? (
        <Pressable
          onPress={onCommentPress}
          style={styles.commentInput}
          accessibilityRole="button"
          accessibilityLabel="Add a comment"
          {...({ "data-frennix-feed-inline-comment": "true" } as object)}
        >
          <Text
            style={styles.addComment}
            allowFontScaling
            maxFontSizeMultiplier={feedAccessibility.maxFontSizeMultiplier}
          >
            Add a comment…
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: feedLayout.comments.rowGap,
  },
  commentRow: {
    paddingVertical: 1,
  },
  commentText: feedLayoutTypography.commentText,
  author: feedLayoutTypography.commentAuthor,
  commentBody: feedLayoutTypography.commentBody,
  viewAll: {
    ...feedLayoutTypography.commentMuted,
    fontWeight: "600",
    marginBottom: 2,
  },
  commentInput: {
    marginTop: feedLayout.comments.commentInputMarginTop,
  },
  addComment: feedLayoutTypography.commentMuted,
});
