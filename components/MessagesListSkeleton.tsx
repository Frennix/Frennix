import { StyleSheet, View } from "react-native";
import { Skeleton, colors, spacing } from "@frennix/ui";

function ConversationRowSkeleton() {
  return (
    <View style={styles.row}>
      <Skeleton width={52} height={52} style={styles.avatar} />
      <View style={styles.lines}>
        <Skeleton width="42%" height={14} />
        <Skeleton width="68%" height={12} />
      </View>
    </View>
  );
}

export function MessagesListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }, (_, index) => (
        <ConversationRowSkeleton key={index} />
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
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: { borderRadius: 26 },
  lines: { flex: 1, gap: spacing.xs },
});
