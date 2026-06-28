import { StyleSheet, Text, View } from "react-native";
import type { FeedStoryLastWorkout, ProfileAchievement } from "@frennix/types";
import { WorkoutTypeChips, formatRelativeTime, formatStreakBadgeLabel, colors, spacing, typography } from "@frennix/ui";

interface StorySummaryOverlayProps {
  lastWorkout: FeedStoryLastWorkout | null;
  streak: number;
  achievement?: ProfileAchievement | null;
}

/** Minimal workout context overlay — does not block media. */
export function StorySummaryOverlay({
  lastWorkout,
  streak,
  achievement,
}: StorySummaryOverlayProps) {
  if (!lastWorkout) return null;

  const timeLabel = formatRelativeTime(lastWorkout.created_at);
  const streakLabel = formatStreakBadgeLabel(streak);

  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={styles.row}>
        <WorkoutTypeChips types={lastWorkout} maxVisible={2} size="compact" overlay />
        <Text style={styles.meta} numberOfLines={1}>
          {streakLabel} · {timeLabel}
        </Text>
      </View>
      {achievement ? (
        <View style={styles.achievement}>
          <Text style={styles.achievementText}>
            {achievement.emoji} {achievement.label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.xs,
  },
  meta: {
    ...typography.caption,
    color: "rgba(255,255,255,0.88)",
    fontWeight: "600",
  },
  achievement: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(10, 10, 11, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  achievementText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "700",
  },
});
