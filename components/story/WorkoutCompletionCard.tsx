import { StyleSheet, Text, View } from "react-native";
import type { FeedStoryLastWorkout } from "@frennix/types";
import { WorkoutTypeChips, formatStreakBadgeLabel, colors, overlays, spacing, typography } from "@frennix/ui";
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
  aiSummary?: string | null;
}

/** Premium workout summary card for story footer. */
export function WorkoutCompletionCard({
  lastWorkout,
  streak,
  achievement,
  aiSummary,
}: WorkoutCompletionCardProps) {
  const metrics = lastWorkout.metrics;
  const duration = formatStoryDuration(metrics?.duration_seconds);
  const calories = formatStoryCalories(metrics?.calories);
  const distance = formatStoryDistance(metrics?.distance_meters);

  return (
    <View style={styles.card} pointerEvents="none">
      <WorkoutTypeChips types={lastWorkout} maxVisible={2} size="compact" overlay />

      <View style={styles.statsGrid}>
        {duration ? <StatPill label="Duration" value={duration} /> : null}
        {calories ? <StatPill label="Calories" value={calories} /> : null}
        {distance ? <StatPill label="Distance" value={distance} /> : null}
      </View>

      <Text style={styles.completed} numberOfLines={1}>
        {formatStoryCompletedTime(lastWorkout.created_at)}
      </Text>

      {streak > 0 ? (
        <Text style={styles.streak} numberOfLines={1}>
          {formatStreakBadgeLabel(streak)}
        </Text>
      ) : null}

      {achievement ? (
        <View style={styles.achievementBadge}>
          <Text style={styles.achievementText} numberOfLines={1}>
            {achievement.emoji} {achievement.label}
          </Text>
        </View>
      ) : null}

      {aiSummary ? (
        <Text style={styles.aiSummary} numberOfLines={2}>
          {aiSummary}
        </Text>
      ) : null}
    </View>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: "stretch",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    backgroundColor: overlays.glassStrong,
    borderWidth: 1,
    borderColor: overlays.glassBorderStrong,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  statPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: overlays.whiteGhost,
    borderWidth: 1,
    borderColor: overlays.whiteGhostBorder,
  },
  statLabel: {
    ...typography.caption,
    fontSize: 9,
    color: overlays.whiteMuted,
    fontWeight: "600",
  },
  statValue: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "800",
  },
  completed: {
    ...typography.caption,
    color: overlays.whiteSoft,
    fontWeight: "600",
  },
  streak: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "800",
  },
  achievementBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: overlays.warningTintSoft,
    borderWidth: 1,
    borderColor: overlays.warningBorderSoft,
  },
  achievementText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "800",
  },
  aiSummary: {
    ...typography.caption,
    color: overlays.whiteStrong,
    lineHeight: 16,
    fontStyle: "italic",
  },
});
