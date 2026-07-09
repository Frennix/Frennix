import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { ChallengeLeaderboardScope } from "@frennix/types";
import { colors, spacing, typography } from "@frennix/ui";

const SCOPES: { id: ChallengeLeaderboardScope; label: string }[] = [
  { id: "overall", label: "Overall" },
  { id: "friends", label: "Friends" },
  { id: "weekly", label: "Weekly" },
  { id: "daily", label: "Daily" },
];

type Props = {
  value: ChallengeLeaderboardScope;
  onChange: (value: ChallengeLeaderboardScope) => void;
};

export function ChallengeLeaderboardScopeBar({ value, onChange }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {SCOPES.map((scope) => {
        const active = value === scope.id;
        return (
          <Pressable
            key={scope.id}
            onPress={() => onChange(scope.id)}
            style={[styles.chip, active && styles.chipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{scope.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipActive: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  chipText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  chipTextActive: {
    color: colors.accent,
  },
});
