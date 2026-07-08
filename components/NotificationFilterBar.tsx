import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NotificationCategory } from "@frennix/notifications";
import { colors, spacing, typography } from "@frennix/ui";

export type NotificationFilterId = NotificationCategory | "all";

const FILTERS: { id: NotificationFilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "messages", label: "Messages" },
  { id: "social", label: "Social" },
  { id: "events", label: "Events" },
  { id: "challenges", label: "Challenges" },
  { id: "system", label: "System" },
];

type Props = {
  value: NotificationFilterId;
  onChange: (value: NotificationFilterId) => void;
};

export function NotificationFilterBar({ value, onChange }: Props) {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {FILTERS.map((filter) => {
          const active = value === filter.id;
          return (
            <Pressable
              key={filter.id}
              onPress={() => onChange(filter.id)}
              style={[styles.chip, active && styles.chipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {filter.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  row: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
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
    fontWeight: "700",
  },
});
