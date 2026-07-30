import { memo } from "react";
import { Platform, StyleSheet, Text, View, type ViewStyle } from "react-native";
import type { WorkoutStoryMetrics } from "@frennix/types";
import { applyShadow, colors, overlays, radius, spacing, typography } from "./theme";

export interface WorkoutStatsPillsProps {
  metrics?: WorkoutStoryMetrics | null;
  milestones?: string[] | null;
  style?: ViewStyle;
}

function formatDuration(seconds?: number | null): string | null {
  if (seconds == null || seconds <= 0) return null;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes} min`;
  return `${seconds}s`;
}

function formatDistance(meters?: number | null): string | null {
  if (meters == null || meters <= 0) return null;
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

function formatCalories(calories?: number | null): string | null {
  if (calories == null || calories <= 0) return null;
  return `${Math.round(calories)}`;
}

function formatWeight(extra?: Record<string, unknown>): string | null {
  const raw = extra?.weight_lifted_kg ?? extra?.weight_kg ?? extra?.total_weight_kg;
  if (typeof raw !== "number" || raw <= 0) return null;
  return `${Math.round(raw)} kg`;
}

function hasPersonalRecord(milestones?: string[] | null): boolean {
  if (!milestones?.length) return false;
  return milestones.some((m) => /personal.?record|pr/i.test(m));
}

export const WorkoutStatsPills = memo(function WorkoutStatsPills({
  metrics,
  milestones,
  style,
}: WorkoutStatsPillsProps) {
  if (!metrics && !hasPersonalRecord(milestones)) return null;

  const duration = formatDuration(metrics?.duration_seconds);
  const distance = formatDistance(metrics?.distance_meters);
  const calories = formatCalories(metrics?.calories);
  const weight = formatWeight(metrics?.extra);
  const isPr = hasPersonalRecord(milestones);

  const pills: Array<{ emoji: string; label: string; value: string; accent?: boolean }> = [];
  if (calories) pills.push({ emoji: "🔥", label: "Calories", value: calories });
  if (duration) pills.push({ emoji: "⏱", label: "Duration", value: duration });
  if (distance) pills.push({ emoji: "📍", label: "Distance", value: distance });
  if (weight) pills.push({ emoji: "🏋️", label: "Weight", value: weight });
  if (isPr) pills.push({ emoji: "📈", label: "Personal Record", value: "PR", accent: true });

  if (!pills.length) return null;

  return (
    <View style={[styles.row, style]}>
      {pills.map((pill) => (
        <View key={pill.label} style={[styles.pill, pill.accent && styles.pillAccent]}>
          <Text style={styles.pillEmoji}>{pill.emoji}</Text>
          <View style={styles.pillText}>
            <Text style={[styles.pillValue, pill.accent && styles.pillValueAccent]}>{pill.value}</Text>
            <Text style={styles.pillLabel}>{pill.label}</Text>
          </View>
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...(Platform.OS === "web"
      ? ({ backdropFilter: "blur(8px)" } as ViewStyle)
      : null),
  },
  pillAccent: {
    backgroundColor: overlays.accentTint,
    borderColor: overlays.accentBorder,
    ...applyShadow("accent"),
  },
  pillEmoji: {
    fontSize: 14,
    lineHeight: 18,
  },
  pillText: {
    gap: 0,
  },
  pillValue: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "800",
    fontSize: 12,
    lineHeight: 14,
  },
  pillValueAccent: {
    color: colors.accent,
  },
  pillLabel: {
    ...typography.caption,
    fontSize: 10,
    lineHeight: 12,
    color: colors.textMuted,
    fontWeight: "600",
  },
});
