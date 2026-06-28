import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { normalizeWorkoutTypes } from "@frennix/types";
import { formatWorkoutTypeLabel, workoutTypeEmoji } from "./formatRelativeTime";
import { colors, radius, spacing, typography } from "./theme";

type WorkoutTypeSource =
  | string[]
  | {
      workout_types?: string[] | null;
      workout_type?: string | null;
    };

interface WorkoutTypeChipsProps {
  types?: WorkoutTypeSource | null;
  maxVisible?: number;
  size?: "compact" | "default";
  style?: StyleProp<ViewStyle>;
  overlay?: boolean;
}

function resolveWorkoutTypes(types?: WorkoutTypeSource | null): string[] {
  if (!types) return [];
  if (Array.isArray(types)) return types.filter(Boolean);
  return normalizeWorkoutTypes(types);
}

export function WorkoutTypeChips({
  types,
  maxVisible,
  size = "default",
  style,
  overlay = false,
}: WorkoutTypeChipsProps) {
  const resolved = resolveWorkoutTypes(types);
  if (!resolved.length) return null;

  const visible = maxVisible ? resolved.slice(0, maxVisible) : resolved;
  const hiddenCount = maxVisible ? Math.max(0, resolved.length - maxVisible) : 0;
  const compact = size === "compact";

  return (
    <View style={[styles.row, style]}>
      {visible.map((type) => (
        <View
          key={type}
          style={[
            styles.chip,
            compact && styles.chipCompact,
            overlay && styles.chipOverlay,
          ]}
        >
          <Text
            style={[styles.chipText, compact && styles.chipTextCompact, overlay && styles.chipTextOverlay]}
            numberOfLines={1}
          >
            {workoutTypeEmoji(type)} {formatWorkoutTypeLabel(type)}
          </Text>
        </View>
      ))}
      {hiddenCount > 0 ? (
        <View
          style={[
            styles.chip,
            styles.moreChip,
            compact && styles.chipCompact,
            overlay && styles.chipOverlay,
          ]}
        >
          <Text
            style={[
              styles.chipText,
              styles.moreText,
              compact && styles.chipTextCompact,
              overlay && styles.chipTextOverlay,
            ]}
            numberOfLines={1}
          >
            +{hiddenCount} more
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: "100%",
  },
  chipCompact: {
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  chipOverlay: {
    backgroundColor: "rgba(20, 20, 22, 0.88)",
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  moreChip: {
    backgroundColor: colors.surface,
  },
  chipText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  chipTextCompact: {
    fontSize: 11,
    lineHeight: 14,
  },
  chipTextOverlay: {
    color: colors.text,
  },
  moreText: {
    color: colors.textMuted,
  },
});
