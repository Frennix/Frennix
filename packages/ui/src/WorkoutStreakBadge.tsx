import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "./theme";

interface WorkoutStreakBadgeProps {
  streak: number;
}

export function WorkoutStreakBadge({ streak }: WorkoutStreakBadgeProps) {
  const active = streak > 0;

  return (
    <View style={[styles.badge, active ? styles.badgeActive : styles.badgeInactive]}>
      <Text style={styles.icon}>{active ? "🔥" : "💤"}</Text>
      <View style={styles.textBlock}>
        <Text style={[styles.count, active && styles.countActive]}>
          {streak} day{streak === 1 ? "" : "s"} streak
        </Text>
        <Text style={styles.hint}>
          {active ? "Keep it going — post today to extend your streak" : "Post a workout to start your streak"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  badgeActive: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  badgeInactive: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  icon: { fontSize: 28, lineHeight: 32 },
  textBlock: { flex: 1, gap: 2 },
  count: { ...typography.body, fontWeight: "700", color: colors.textSecondary },
  countActive: { color: colors.accent },
  hint: { ...typography.caption, color: colors.textMuted, lineHeight: 16 },
});
