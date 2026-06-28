import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { ActivityCategory, FounderDatePreset } from "@frennix/types";
import { ACTIVITY_CATEGORY_FILTERS, FOUNDER_DATE_PRESETS } from "@frennix/types";
import { colors, spacing, typography } from "@frennix/ui";

type FounderFilterBarProps = {
  datePreset: FounderDatePreset;
  onDatePresetChange: (preset: FounderDatePreset) => void;
  category?: ActivityCategory;
  onCategoryChange?: (category: ActivityCategory) => void;
  search: string;
  onSearchChange: (value: string) => void;
  sortDir?: "asc" | "desc";
  onSortDirToggle?: () => void;
  showCategoryFilters?: boolean;
  showSearch?: boolean;
};

export function FounderFilterBar({
  datePreset,
  onDatePresetChange,
  category = "all",
  onCategoryChange,
  search,
  onSearchChange,
  sortDir = "desc",
  onSortDirToggle,
  showCategoryFilters = false,
  showSearch = true,
}: FounderFilterBarProps) {
  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {FOUNDER_DATE_PRESETS.map((preset) => (
          <Pressable
            key={preset.key}
            accessibilityRole="button"
            onPress={() => onDatePresetChange(preset.key)}
            style={[styles.chip, datePreset === preset.key && styles.chipActive]}
          >
            <Text style={[styles.chipText, datePreset === preset.key && styles.chipTextActive]}>
              {preset.label}
            </Text>
          </Pressable>
        ))}
        {onSortDirToggle ? (
          <Pressable accessibilityRole="button" onPress={onSortDirToggle} style={styles.chip}>
            <Text style={styles.chipText}>Sort {sortDir === "desc" ? "↓" : "↑"}</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <TextInput
        value={search}
        onChangeText={onSearchChange}
        placeholder="Search…"
        placeholderTextColor={colors.textMuted}
        style={[styles.search, !showSearch && styles.hidden]}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />

      {showCategoryFilters && onCategoryChange ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {ACTIVITY_CATEGORY_FILTERS.map((filter) => (
            <Pressable
              key={filter.key}
              accessibilityRole="button"
              onPress={() => onCategoryChange(filter.key)}
              style={[styles.chip, category === filter.key && styles.chipActive]}
            >
              <Text style={[styles.chipText, category === filter.key && styles.chipTextActive]}>
                {filter.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { gap: spacing.xs, paddingVertical: 2 },
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    justifyContent: "center",
  },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.surface },
  chipText: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },
  chipTextActive: { color: colors.accent },
  search: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    color: colors.text,
    backgroundColor: colors.background,
    ...typography.bodySmall,
  },
  hidden: { display: "none", height: 0, minHeight: 0, margin: 0, padding: 0, borderWidth: 0 },
});
