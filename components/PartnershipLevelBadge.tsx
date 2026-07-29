import { StyleSheet, Text, View } from "react-native";
import type { PartnershipLevelDefinition } from "@frennix/types";
import { colors, spacing, typography } from "@frennix/ui";

type PartnershipLevelBadgeProps = {
  level: PartnershipLevelDefinition;
  compact?: boolean;
};

export function PartnershipLevelBadge({ level, compact }: PartnershipLevelBadgeProps) {
  return (
    <View style={[styles.badge, compact && styles.badgeCompact]}>
      <Text style={[styles.emoji, compact && styles.emojiCompact]}>{level.emoji}</Text>
      <View style={styles.copy}>
        <Text style={[styles.label, compact && styles.labelCompact]}>{level.label}</Text>
        {!compact ? <Text style={styles.description}>{level.description}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  badgeCompact: {
    alignItems: "center",
    padding: spacing.md,
    gap: spacing.sm,
  },
  emoji: { fontSize: 32, lineHeight: 38 },
  emojiCompact: { fontSize: 24, lineHeight: 28 },
  copy: { flex: 1, gap: spacing.xxs },
  label: { ...typography.body, fontWeight: "700", color: colors.text },
  labelCompact: { ...typography.caption, fontWeight: "700", textAlign: "center" },
  description: { ...typography.bodySmall, color: colors.textMuted, lineHeight: 20 },
});
