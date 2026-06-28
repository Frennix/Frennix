import { StyleSheet, View } from "react-native";
import { Skeleton, colors, spacing } from "@frennix/ui";

function CardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width="55%" height={16} />
      <Skeleton width="88%" height={12} />
      <Skeleton width="72%" height={12} />
    </View>
  );
}

export function DiscoverListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }, (_, index) => (
        <CardSkeleton key={index} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm, paddingVertical: spacing.xs },
  card: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
