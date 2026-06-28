import { StyleSheet, View } from "react-native";
import { Skeleton, colors, spacing } from "@frennix/ui";

function FollowRowSkeleton() {
  return (
    <View style={styles.row}>
      <Skeleton width={48} height={48} style={styles.avatar} />
      <View style={styles.lines}>
        <Skeleton width="38%" height={14} />
        <Skeleton width="52%" height={12} />
      </View>
      <Skeleton width={72} height={32} style={styles.button} />
    </View>
  );
}

export function UserFollowListSkeleton({ count = 10 }: { count?: number }) {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }, (_, index) => (
        <FollowRowSkeleton key={index} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: { borderRadius: 24 },
  lines: { flex: 1, gap: spacing.xs },
  button: { borderRadius: 8 },
});
