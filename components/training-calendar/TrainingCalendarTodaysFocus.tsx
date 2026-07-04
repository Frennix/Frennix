import { Pressable, StyleSheet, Text, View } from "react-native";
import type { TodaysFocusData } from "@/lib/training-calendar-focus";
import { openCalendarViewItem, startTodaysWorkout } from "@/lib/training-calendar-navigation";
import { TrainingTogetherTodaySection } from "@/components/training-calendar/TrainingTogetherTodaySection";
import { hapticMedium } from "@/lib/haptics";
import { colors, spacing, typography } from "@frennix/ui";

type TrainingCalendarTodaysFocusProps = {
  focus: TodaysFocusData;
};

export function TrainingCalendarTodaysFocus({ focus }: TrainingCalendarTodaysFocusProps) {
  const weeklyRatio =
    focus.weeklyScheduled > 0
      ? Math.min(focus.weeklyCompleted / focus.weeklyScheduled, 1)
      : focus.weeklyCompleted > 0
        ? 1
        : 0;

  function handleStartWorkout() {
    hapticMedium();
    startTodaysWorkout(focus);
  }

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Today&apos;s Focus</Text>
      <Text style={styles.dashboardTagline}>Your daily fitness dashboard</Text>

      <Text style={[styles.headline, focus.isRestDay && styles.headlineRest]} numberOfLines={2}>
        {focus.todayHeadline}
      </Text>
      {focus.todaySubline ? (
        <Text style={styles.subline} numberOfLines={2}>
          {focus.todaySubline}
        </Text>
      ) : null}

      <View style={styles.statsRow}>
        <View style={styles.statChip}>
          <Text style={styles.statValue}>{focus.streak}</Text>
          <Text style={styles.statLabel}>day streak</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statChipWide}>
          <Text style={styles.statLabel}>{focus.weeklyProgressLabel}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(weeklyRatio * 100)}%` }]} />
          </View>
        </View>
      </View>

      {focus.nextLabel ? (
        <Pressable
          style={styles.nextRow}
          onPress={() => focus.nextItem && openCalendarViewItem(focus.nextItem)}
          disabled={!focus.nextItem}
        >
          <Text style={styles.nextLabel}>Next up</Text>
          <Text style={styles.nextValue} numberOfLines={2}>
            {focus.nextLabel}
          </Text>
        </Pressable>
      ) : null}

      <Pressable style={styles.primaryButton} onPress={handleStartWorkout}>
        <Text style={styles.primaryButtonText}>{focus.startWorkoutLabel}</Text>
      </Pressable>

      <TrainingTogetherTodaySection partners={focus.partnersTrainingToday} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    maxWidth: "100%",
    padding: spacing.md,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
    gap: spacing.sm,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  dashboardTagline: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "600",
    marginTop: -4,
  },
  headline: {
    ...typography.heading,
    color: colors.text,
    fontWeight: "800",
  },
  headlineRest: {
    color: colors.textSecondary,
  },
  subline: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  statChip: {
    alignItems: "center",
    minWidth: 72,
  },
  statChipWide: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    backgroundColor: colors.border,
  },
  statValue: {
    ...typography.heading,
    color: colors.accent,
    fontWeight: "800",
    lineHeight: 30,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "600",
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  nextRow: {
    paddingVertical: spacing.xs,
    gap: 2,
  },
  nextLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  nextValue: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: "600",
  },
  primaryButton: {
    marginTop: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: "center",
  },
  primaryButtonText: {
    ...typography.body,
    color: colors.black,
    fontWeight: "800",
  },
});
