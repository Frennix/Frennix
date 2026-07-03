import { StyleSheet, Text, View } from "react-native";
import type { LifestyleProfileFields } from "@frennix/types";
import { getLifestyleBadges } from "@/lib/lifestyle-matching";
import { colors, spacing, typography } from "@frennix/ui";

interface LifestyleBadgesProps {
  profile: LifestyleProfileFields;
}

export function LifestyleBadges({ profile }: LifestyleBadgesProps) {
  const badges = getLifestyleBadges(profile);
  if (!badges.length) return null;

  return (
    <View style={styles.row}>
      {badges.map((label) => (
        <View key={label} style={styles.badge}>
          <Text style={styles.badgeText}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  badgeText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "600",
  },
});
