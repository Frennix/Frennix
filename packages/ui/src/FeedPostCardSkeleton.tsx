import { StyleSheet, View } from "react-native";
import { Skeleton } from "./Skeleton";
import { colors, spacing } from "./theme";

export function FeedPostCardSkeleton() {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Skeleton width={44} height={44} style={styles.avatar} />
        <View style={styles.headerLines}>
          <Skeleton width="48%" height={14} />
          <Skeleton width="32%" height={12} />
          <Skeleton width="60%" height={12} />
        </View>
      </View>
      <Skeleton width="100%" height={240} style={styles.media} />
      <View style={styles.actions}>
        <Skeleton width={56} height={14} />
        <Skeleton width={56} height={14} />
        <Skeleton width={72} height={14} />
        <Skeleton width={52} height={14} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  avatar: { borderRadius: 22 },
  headerLines: { flex: 1, gap: spacing.xs },
  media: { marginTop: spacing.sm },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
});
