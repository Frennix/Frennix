import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { DiscoverSearchFilters } from "@frennix/types";
import { hasActiveDiscoverSearchFilters } from "@frennix/types";
import { Chip, colors, spacing, typography } from "@frennix/ui";

type DiscoverSearchFiltersProps = {
  filters: DiscoverSearchFilters;
  onChange: (next: DiscoverSearchFilters) => void;
};

function toggle(filters: DiscoverSearchFilters, key: keyof DiscoverSearchFilters): DiscoverSearchFilters {
  const next = { ...filters };
  if (next[key]) {
    delete next[key];
  } else {
    next[key] = true;
  }
  return next;
}

const FILTER_OPTIONS: Array<{ key: keyof DiscoverSearchFilters; label: string }> = [
  { key: "nearby", label: "Nearby" },
  { key: "sameGoals", label: "Same goals" },
  { key: "sameInterests", label: "Same interests" },
  { key: "trainingPartners", label: "Training partners" },
  { key: "trainers", label: "Trainers" },
  { key: "newMembers", label: "New members" },
];

export function DiscoverSearchFiltersBar({ filters, onChange }: DiscoverSearchFiltersProps) {
  const active = hasActiveDiscoverSearchFilters(filters);

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Search filters</Text>
        {active ? (
          <Pressable onPress={() => onChange({})} hitSlop={8}>
            <Text style={styles.clear}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {FILTER_OPTIONS.map((option) => (
          <Chip
            key={option.key}
            label={option.label}
            selected={filters[option.key] === true}
            onPress={() => onChange(toggle(filters, option.key))}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xs },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { ...typography.caption, fontWeight: "700", color: colors.textSecondary, textTransform: "uppercase" },
  clear: { ...typography.caption, color: colors.accent, fontWeight: "600" },
  chipRow: { gap: spacing.sm, paddingVertical: 2 },
});
