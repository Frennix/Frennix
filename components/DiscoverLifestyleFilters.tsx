import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { DiscoverCompatibilityFilters } from "@frennix/types";
import { FRENIX_MATCH_BRAND } from "@frennix/matching";
import {
  CHILDREN_AGE_GROUPS,
  COMPATIBILITY_FILTER_THRESHOLDS,
  LIFESTYLE_BRAND,
  DISCOVER_ACTIVITY_FILTERS,
  DISCOVER_GOAL_FILTERS,
  DISTANCE_FILTER_OPTIONS,
  PREFERRED_WORKOUT_TIMES,
  formatChildrenAgeGroup,
  formatPreferredWorkoutTime,
  hasActiveDiscoverFilters,
} from "@/lib/lifestyle-matching";
import { formatActivity, formatGoal } from "@/lib/labels";
import { Chip, colors, spacing, typography } from "@frennix/ui";

interface DiscoverCompatibilityFiltersProps {
  filters: DiscoverCompatibilityFilters;
  onChange: (next: DiscoverCompatibilityFilters) => void;
}

function toggle<T extends DiscoverCompatibilityFilters, K extends keyof T>(
  filters: T,
  key: K,
  value?: T[K]
): T {
  const next = { ...filters };
  if (next[key] === value) {
    delete next[key];
  } else if (value !== undefined) {
    next[key] = value;
  } else if (typeof next[key] === "boolean") {
    delete next[key];
  } else {
    (next as Record<string, unknown>)[key as string] = true;
  }
  return next;
}

export function DiscoverCompatibilityFilters({
  filters,
  onChange,
}: DiscoverCompatibilityFiltersProps) {
  const active = hasActiveDiscoverFilters(filters);

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{LIFESTYLE_BRAND.discoverFiltersTitle}</Text>
        {active ? (
          <Pressable onPress={() => onChange({})} hitSlop={8}>
            <Text style={styles.clear}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.hint}>{LIFESTYLE_BRAND.filtersHint}</Text>

      <Text style={styles.groupLabel}>Lifestyle</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <Chip
          label="Parents"
          selected={filters.parentsOnly === true}
          onPress={() =>
            onChange(
              filters.parentsOnly
                ? { ...filters, parentsOnly: undefined, parentType: undefined }
                : { ...filters, parentsOnly: true }
            )
          }
        />
        <Chip
          label="Moms"
          selected={filters.parentType === "mom"}
          onPress={() =>
            onChange(
              filters.parentType === "mom"
                ? { ...filters, parentType: undefined }
                : { ...filters, parentType: "mom", parentsOnly: true }
            )
          }
        />
        <Chip
          label="Dads"
          selected={filters.parentType === "dad"}
          onPress={() =>
            onChange(
              filters.parentType === "dad"
                ? { ...filters, parentType: undefined }
                : { ...filters, parentType: "dad", parentsOnly: true }
            )
          }
        />
        <Chip
          label="Kid-friendly"
          selected={filters.kidFriendlyWorkouts === true}
          onPress={() => onChange(toggle(filters, "kidFriendlyWorkouts", true))}
        />
        <Chip
          label="Parent partner"
          selected={filters.lookingForParentPartner === true}
          onPress={() => onChange(toggle(filters, "lookingForParentPartner", true))}
        />
      </ScrollView>

      <Text style={styles.groupLabel}>Workout time</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {PREFERRED_WORKOUT_TIMES.map((slot) => (
          <Chip
            key={slot}
            label={formatPreferredWorkoutTime(slot)}
            selected={filters.preferredWorkoutTime === slot}
            onPress={() => onChange(toggle(filters, "preferredWorkoutTime", slot))}
          />
        ))}
      </ScrollView>

      <Text style={styles.groupLabel}>Children age</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {CHILDREN_AGE_GROUPS.map((group) => (
          <Chip
            key={group}
            label={formatChildrenAgeGroup(group)}
            selected={filters.childrenAgeGroup === group}
            onPress={() => onChange(toggle(filters, "childrenAgeGroup", group))}
          />
        ))}
      </ScrollView>

      <Text style={styles.groupLabel}>Goals</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {DISCOVER_GOAL_FILTERS.slice(0, 6).map((goal) => (
          <Chip
            key={goal}
            label={formatGoal(goal)}
            selected={filters.goal === goal}
            onPress={() => onChange(toggle(filters, "goal", goal))}
          />
        ))}
      </ScrollView>

      <Text style={styles.groupLabel}>Interests</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {DISCOVER_ACTIVITY_FILTERS.slice(0, 8).map((activity) => (
          <Chip
            key={activity}
            label={formatActivity(activity)}
            selected={filters.activity === activity}
            onPress={() => onChange(toggle(filters, "activity", activity))}
          />
        ))}
      </ScrollView>

      <Text style={styles.groupLabel}>Distance</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {DISTANCE_FILTER_OPTIONS.map((opt) => (
          <Chip
            key={opt.value}
            label={opt.label}
            selected={filters.maxDistanceMiles === opt.value}
            onPress={() => onChange(toggle(filters, "maxDistanceMiles", opt.value))}
          />
        ))}
      </ScrollView>

      <Text style={styles.groupLabel}>{FRENIX_MATCH_BRAND.sections.filterMinLabel}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {COMPATIBILITY_FILTER_THRESHOLDS.map((opt) => (
          <Chip
            key={opt.value}
            label={opt.label}
            selected={filters.minCompatibility === opt.value}
            onPress={() => onChange(toggle(filters, "minCompatibility", opt.value))}
          />
        ))}
      </ScrollView>
    </View>
  );
}

/** @deprecated Use DiscoverCompatibilityFilters */
export const DiscoverLifestyleFilters = DiscoverCompatibilityFilters;

const styles = StyleSheet.create({
  root: { gap: spacing.sm, marginBottom: spacing.sm },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { ...typography.bodySmall, fontWeight: "700", color: colors.textSecondary },
  clear: { ...typography.caption, color: colors.accent, fontWeight: "600" },
  hint: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  groupLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "600",
    marginTop: spacing.xs,
  },
  chipRow: { gap: spacing.sm, paddingRight: spacing.md },
});
