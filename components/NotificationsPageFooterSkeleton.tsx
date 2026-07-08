import { ActivityIndicator, StyleSheet, View } from "react-native";
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

export function NotificationsPageFooterSkeleton() {
  return (
    <View style={styles.footer}>
      <ActivityIndicator color={colors.accent} />
      <NotificationRowSkeleton />
      <NotificationRowSkeleton />
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  avatar: { borderRadius: 24 },
  lines: { flex: 1, gap: spacing.xs },
});
