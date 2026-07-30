import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from "react-native";
import type { ReactNode } from "react";
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
import { webHorizontalScrollStyle } from "@/lib/flex-layout";
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

function FilterChipRow({ children }: { children: ReactNode }) {
  return (
    <View style={styles.chipRowShell}>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        style={[styles.chipRowScroll, webHorizontalScrollStyle]}
        contentContainerStyle={styles.chipRowContent}
      >
        {children}
      </ScrollView>
    </View>
  );
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
      <FilterChipRow>
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
      </FilterChipRow>

      <Text style={styles.groupLabel}>Workout time</Text>
      <FilterChipRow>
        {PREFERRED_WORKOUT_TIMES.map((slot) => (
          <Chip
            key={slot}
            label={formatPreferredWorkoutTime(slot)}
            selected={filters.preferredWorkoutTime === slot}
            onPress={() => onChange(toggle(filters, "preferredWorkoutTime", slot))}
          />
        ))}
      </FilterChipRow>

      <Text style={styles.groupLabel}>Children age</Text>
      <FilterChipRow>
        {CHILDREN_AGE_GROUPS.map((group) => (
          <Chip
            key={group}
            label={formatChildrenAgeGroup(group)}
            selected={filters.childrenAgeGroup === group}
            onPress={() => onChange(toggle(filters, "childrenAgeGroup", group))}
          />
        ))}
      </FilterChipRow>

      <Text style={styles.groupLabel}>Goals</Text>
      <FilterChipRow>
        {DISCOVER_GOAL_FILTERS.slice(0, 6).map((goal) => (
          <Chip
            key={goal}
            label={formatGoal(goal)}
            selected={filters.goal === goal}
            onPress={() => onChange(toggle(filters, "goal", goal))}
          />
        ))}
      </FilterChipRow>

      <Text style={styles.groupLabel}>Interests</Text>
      <FilterChipRow>
        {DISCOVER_ACTIVITY_FILTERS.slice(0, 8).map((activity) => (
          <Chip
            key={activity}
            label={formatActivity(activity)}
            selected={filters.activity === activity}
            onPress={() => onChange(toggle(filters, "activity", activity))}
          />
        ))}
      </FilterChipRow>

      <Text style={styles.groupLabel}>Distance</Text>
      <FilterChipRow>
        {DISTANCE_FILTER_OPTIONS.map((opt) => (
          <Chip
            key={opt.value}
            label={opt.label}
            selected={filters.maxDistanceMiles === opt.value}
            onPress={() => onChange(toggle(filters, "maxDistanceMiles", opt.value))}
          />
        ))}
      </FilterChipRow>

      <Text style={styles.groupLabel}>{FRENIX_MATCH_BRAND.sections.filterMinLabel}</Text>
      <FilterChipRow>
        {COMPATIBILITY_FILTER_THRESHOLDS.map((opt) => (
          <Chip
            key={opt.value}
            label={opt.label}
            selected={filters.minCompatibility === opt.value}
            onPress={() => onChange(toggle(filters, "minCompatibility", opt.value))}
          />
        ))}
      </FilterChipRow>
    </View>
  );
}

/** @deprecated Use DiscoverCompatibilityFilters */
export const DiscoverLifestyleFilters = DiscoverCompatibilityFilters;

const styles = StyleSheet.create({
  root: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
  },
  title: { ...typography.bodySmall, fontWeight: "700", color: colors.textSecondary, flex: 1, minWidth: 0 },
  clear: { ...typography.caption, color: colors.accent, fontWeight: "600", flexShrink: 0 },
  hint: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  groupLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "600",
    marginTop: spacing.xs,
  },
  chipRowShell: {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    overflow: "hidden",
  },
  chipRowScroll: {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    flexGrow: 0,
    ...(Platform.OS === "web" ? ({ boxSizing: "border-box" } as ViewStyle) : null),
  },
  chipRowContent: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingRight: spacing.md,
    alignItems: "center",
  },
});
