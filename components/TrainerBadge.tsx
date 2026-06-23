import { StyleSheet, Text, View } from "react-native";
import type { TrainerVerificationLevel } from "@frennix/types";
import { formatVerificationLevel } from "@/lib/trainer-labels";
import { colors, radius, spacing, typography } from "@frennix/ui";

type TrainerBadgeProps = {
  level: TrainerVerificationLevel;
  compact?: boolean;
};

export function TrainerBadge({ level, compact = false }: TrainerBadgeProps) {
  if (level === "trainer") return null;

  const isFeatured = level === "featured";

  return (
    <View style={[styles.badge, isFeatured ? styles.featured : styles.verified, compact && styles.compact]}>
      <Text style={[styles.text, isFeatured ? styles.featuredText : styles.verifiedText]}>
        {formatVerificationLevel(level)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  compact: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  verified: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.35)",
  },
  featured: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.4)",
  },
  text: {
    ...typography.caption,
    fontWeight: "700",
  },
  verifiedText: {
    color: colors.accent,
  },
  featuredText: {
    color: "#F59E0B",
  },
});
