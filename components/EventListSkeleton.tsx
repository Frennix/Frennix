import { StyleSheet, View } from "react-native";
import { Skeleton, colors, spacing } from "@frennix/ui";

function EventRowSkeleton() {
  return (
    <View style={styles.row}>
      <Skeleton width={72} height={72} style={styles.thumb} />
      <View style={styles.lines}>
        <Skeleton width="70%" height={16} />
        <Skeleton width="45%" height={12} />
        <Skeleton width="55%" height={12} />
      </View>
    </View>
  );
}

export function EventListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }, (_, index) => (
        <EventRowSkeleton key={index} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  thumb: { borderRadius: 12 },
  lines: { flex: 1, gap: spacing.xs, justifyContent: "center" },
});
