import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { MatchReason } from "@frennix/types";
import { colors, overlays, radius, spacing, typography } from "@frennix/ui";

const DEFAULT_TITLE = "Why You Match";
const DEFAULT_MAX = 3;

type MatchReasonsListProps = {
  reasons: MatchReason[];
  title?: string;
  maxItems?: number;
  variant?: "default" | "deck";
};

/** Frennix Match explanation — every recommendation explains itself. */
export function MatchReasonsList({
  reasons,
  title = DEFAULT_TITLE,
  maxItems = DEFAULT_MAX,
  variant = "default",
}: MatchReasonsListProps) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = reasons.length > maxItems;
  const visible = expanded ? reasons : reasons.slice(0, maxItems);
  const isDeck = variant === "deck";

  if (!visible.length) return null;

  return (
    <View style={[styles.wrap, isDeck && styles.wrapDeck]}>
      <Text style={[styles.title, isDeck && styles.titleDeck]}>{title}</Text>
      <View style={styles.list}>
        {visible.map((reason) => (
          <View key={`${reason.code}-${reason.label}`} style={styles.row}>
            <Text style={styles.bullet}>✓</Text>
            <Text style={styles.label}>{reason.label}</Text>
          </View>
        ))}
      </View>
      {hasMore && !expanded ? (
        <Pressable
          onPress={() => setExpanded(true)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="View all match reasons"
        >
          <Text style={styles.viewAll}>View all reasons</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  wrapDeck: {
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    backgroundColor: overlays.accentTintSoft,
  },
  title: {
    ...typography.section,
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  titleDeck: {
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
  viewAll: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "600",
    marginTop: 2,
  },
});
