import { StyleSheet, View } from "react-native";
import { Skeleton, colors, spacing } from "@frennix/ui";

function NotificationRowSkeleton() {
  return (
    <View style={styles.row}>
      <Skeleton width={48} height={48} style={styles.avatar} />
      <View style={styles.lines}>
        <Skeleton width="72%" height={14} />
        <Skeleton width="38%" height={12} />
      </View>
    </View>
  );
}

export function NotificationsListSkeleton({ count = 10 }: { count?: number }) {
  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <Skeleton width="68%" height={16} />
        <Skeleton width="92%" height={12} />
      </View>
      {Array.from({ length: count }, (_, index) => (
        <NotificationRowSkeleton key={index} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  summary: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: { borderRadius: 24 },
  lines: { flex: 1, gap: spacing.xs },
});
