import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { ProfileAchievement } from "@frennix/types";
import { colors, radius, spacing, typography } from "./theme";

interface ProfileAchievementBadgesProps {
  achievements: ProfileAchievement[];
}

export function ProfileAchievementBadges({ achievements }: ProfileAchievementBadgesProps) {
  if (!achievements.length) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Achievements</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {achievements.map((badge) => (
          <View key={badge.id} style={styles.badge} accessibilityLabel={badge.description}>
            <Text style={styles.emoji}>{badge.emoji}</Text>
            <View style={styles.textBlock}>
              <Text style={styles.label}>{badge.label}</Text>
              <Text style={styles.description} numberOfLines={2}>
                {badge.description}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    ...typography.body,
    fontWeight: "700",
    color: colors.text,
  },
  row: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 220,
  },
  emoji: { fontSize: 24, lineHeight: 28 },
  textBlock: { flexShrink: 1, gap: 2 },
  label: { ...typography.bodySmall, fontWeight: "700", color: colors.text },
  description: { ...typography.caption, color: colors.textMuted, lineHeight: 14 },
});
