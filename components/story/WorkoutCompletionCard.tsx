import { StyleSheet, Text, View } from "react-native";
import type { FeedStoryLastWorkout } from "@frennix/types";
import { WorkoutTypeChips, formatStreakBadgeLabel, colors, spacing, typography } from "@frennix/ui";
import {
  formatStoryCalories,
  formatStoryCompletedTime,
  formatStoryDistance,
  formatStoryDuration,
} from "@/lib/story-format";

interface WorkoutCompletionCardProps {
  lastWorkout: FeedStoryLastWorkout;
  streak: number;
  achievement?: { emoji: string; label: string } | null;
}

/** Fitness-first completion summary in the story footer. */
export function WorkoutCompletionCard({
  lastWorkout,
  streak,
  achievement,
}: WorkoutCompletionCardProps) {
  const metrics = lastWorkout.metrics;
  const duration = formatStoryDuration(metrics?.duration_seconds);
  const distance = formatStoryDistance(metrics?.distance_meters);
  const calories = formatStoryCalories(metrics?.calories);
  const statParts = [duration, distance, calories].filter(Boolean);

  return (
    <View style={styles.card} pointerEvents="none">
      <WorkoutTypeChips types={lastWorkout} maxVisible={2} size="compact" overlay />
      {statParts.length ? (
        <Text style={styles.stats} numberOfLines={1}>
          {statParts.join(" · ")}
        </Text>
      ) : null}
      {streak > 0 ? (
        <Text style={styles.streak} numberOfLines={1}>
          {formatStreakBadgeLabel(streak)}
        </Text>
      ) : null}
      {achievement ? (
        <Text style={styles.achievement} numberOfLines={1}>
          {achievement.emoji} {achievement.label}
        </Text>
      ) : null}
      <Text style={styles.completed} numberOfLines={1}>
        Completed {formatStoryCompletedTime(lastWorkout.created_at)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: "flex-start",
    maxWidth: "88%",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: 14,
    backgroundColor: "rgba(10, 10, 11, 0.62)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  stats: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "700",
  },
  streak: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "800",
  },
  achievement: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "800",
  },
  completed: {
    ...typography.caption,
    color: "rgba(255,255,255,0.78)",
    fontWeight: "600",
  },
});
