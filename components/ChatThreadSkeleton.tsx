import { StyleSheet, View } from "react-native";
import { Skeleton, colors, spacing } from "@frennix/ui";

function BubbleSkeleton({ align }: { align: "left" | "right" }) {
  return (
    <View style={[styles.bubbleRow, align === "right" && styles.bubbleRowRight]}>
      {align === "left" ? <Skeleton width={28} height={28} style={styles.avatar} /> : null}
      <Skeleton
        width={align === "right" ? "58%" : "64%"}
        height={44}
        style={styles.bubble}
      />
    </View>
  );
}

export function ChatThreadSkeleton() {
  return (
    <View style={styles.container}>
      <BubbleSkeleton align="left" />
      <BubbleSkeleton align="right" />
      <BubbleSkeleton align="left" />
      <BubbleSkeleton align="left" />
      <BubbleSkeleton align="right" />
      <BubbleSkeleton align="right" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  bubbleRowRight: {
    justifyContent: "flex-end",
  },
  avatar: { borderRadius: 14 },
  bubble: { borderRadius: 16 },
});
