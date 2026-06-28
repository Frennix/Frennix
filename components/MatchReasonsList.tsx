import { StyleSheet, Text, View } from "react-native";
import type { MatchReason } from "@frennix/types";
import { colors, radius, spacing, typography } from "@frennix/ui";

type MatchReasonsListProps = {
  reasons: MatchReason[];
  title?: string;
  maxItems?: number;
};

/** "Why we matched you" — every recommendation explains itself. */
export function MatchReasonsList({
  reasons,
  title = "Why we matched you",
  maxItems = 4,
}: MatchReasonsListProps) {
  const visible = reasons.slice(0, maxItems);
  if (!visible.length) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.list}>
        {visible.map((reason) => (
          <View key={`${reason.code}-${reason.label}`} style={styles.row}>
            <Text style={styles.bullet}>✓</Text>
            <Text style={styles.label}>{reason.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    ...typography.section,
    fontSize: 15,
    color: colors.accent,
  },
  list: { gap: spacing.xs },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  bullet: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: "800",
    lineHeight: 20,
    width: 16,
  },
  label: {
    ...typography.bodySmall,
    color: colors.text,
    flex: 1,
    lineHeight: 20,
    fontWeight: "500",
  },
});
