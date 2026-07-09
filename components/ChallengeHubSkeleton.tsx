import { StyleSheet, View } from "react-native";
import { Skeleton } from "@frennix/ui";
import { spacing } from "@frennix/ui";

export function ChallengeHubSkeleton() {
  return (
    <View style={styles.wrap}>
      <Skeleton width="60%" height={28} />
      <Skeleton width="90%" height={16} />
      <View style={styles.row}>
        <Skeleton width={120} height={36} borderRadius={999} />
        <Skeleton width={140} height={36} borderRadius={999} />
      </View>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.section}>
          <Skeleton width="40%" height={18} />
          <View style={styles.cards}>
            <Skeleton width={280} height={140} borderRadius={16} />
            <Skeleton width={280} height={140} borderRadius={16} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.md, gap: spacing.md },
  row: { flexDirection: "row", gap: spacing.sm },
  section: { gap: spacing.sm },
  cards: { flexDirection: "row", gap: spacing.sm },
});
