import { StyleSheet, View } from "react-native";
import { FeedPostCardSkeleton, Skeleton, colors, spacing } from "@frennix/ui";

function CommentSkeleton() {
  return (
    <View style={styles.comment}>
      <Skeleton width={36} height={36} style={styles.commentAvatar} />
      <View style={styles.commentLines}>
        <Skeleton width="40%" height={12} />
        <Skeleton width="85%" height={14} />
      </View>
    </View>
  );
}

export function PostDetailSkeleton() {
  return (
    <View style={styles.container}>
      <FeedPostCardSkeleton />
      <Skeleton width="35%" height={18} style={styles.sectionTitle} />
      <CommentSkeleton />
      <CommentSkeleton />
      <CommentSkeleton />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  sectionTitle: { marginTop: spacing.md, marginBottom: spacing.sm },
  comment: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  commentAvatar: { borderRadius: 18 },
  commentLines: { flex: 1, gap: spacing.xs },
});
