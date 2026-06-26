import { StyleSheet, View } from "react-native";
import { Skeleton, colors, spacing } from "@frennix/ui";

export function DiscoverProfileSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width={64} height={64} style={styles.avatar} />
      <View style={styles.body}>
        <Skeleton width="50%" height={16} />
        <Skeleton width="35%" height={12} />
        <Skeleton width="90%" height={12} />
        <View style={styles.chips}>
          <Skeleton width={64} height={24} />
          <Skeleton width={72} height={24} />
          <Skeleton width={56} height={24} />
        </View>
      </View>
      <Skeleton width={80} height={36} style={styles.button} />
    </View>
  );
}

export function DiscoverPeopleSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }, (_, index) => (
        <DiscoverProfileSkeleton key={index} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: { borderRadius: 32 },
  body: { flex: 1, gap: spacing.xs },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs },
  button: { borderRadius: 18, alignSelf: "center" },
});
