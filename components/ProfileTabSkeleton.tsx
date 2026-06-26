import { StyleSheet, View } from "react-native";
import { Skeleton, colors, spacing } from "@frennix/ui";

export function ProfileTabSkeleton() {
  return (
    <View style={styles.container}>
      <Skeleton width="100%" height={200} />
      <View style={styles.header}>
        <Skeleton width={112} height={112} style={styles.avatar} />
        <View style={styles.statsRow}>
          <Skeleton width={56} height={36} />
          <Skeleton width={56} height={36} />
          <Skeleton width={56} height={36} />
        </View>
      </View>
      <Skeleton width="55%" height={20} style={styles.name} />
      <Skeleton width="80%" height={14} />
      <Skeleton width="65%" height={14} />
      <View style={styles.tabs}>
        <Skeleton width={72} height={28} />
        <Skeleton width={72} height={28} />
        <Skeleton width={72} height={28} />
      </View>
      <View style={styles.grid}>
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} width="31%" height={110} style={styles.gridItem} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: spacing.md,
    marginTop: -56,
    gap: spacing.lg,
  },
  avatar: { borderRadius: 56, borderWidth: 4, borderColor: colors.background },
  statsRow: { flex: 1, flexDirection: "row", justifyContent: "space-around", paddingBottom: spacing.sm },
  name: { marginHorizontal: spacing.md, marginTop: spacing.md, marginBottom: spacing.sm },
  tabs: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  gridItem: { borderRadius: 8 },
});
