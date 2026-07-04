import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View, type ViewStyle } from "react-native";
import { colors, spacing, typography } from "@frennix/ui";

export type CalendarViewMode = "month" | "week";

type TrainingCalendarViewControlsProps = {
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  periodLabel: string;
  onShiftPeriod: (direction: -1 | 1) => void;
};

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function animateViewModeChange() {
  LayoutAnimation.configureNext(
    LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)
  );
}

/** Wrapper style for sticky Month/Week controls inside the calendar scroll surface. */
export const trainingCalendarStickyControlsStyle: ViewStyle = {
  zIndex: 10,
  backgroundColor: colors.background,
  paddingTop: spacing.xs,
  paddingBottom: spacing.sm,
  width: "100%",
  maxWidth: "100%",
  ...(Platform.OS === "web"
    ? ({
        position: "sticky",
        top: 0,
      } as const)
    : null),
  borderBottomWidth: StyleSheet.hairlineWidth,
  borderBottomColor: colors.border,
};

export function TrainingCalendarViewControls({
  viewMode,
  onViewModeChange,
  periodLabel,
  onShiftPeriod,
}: TrainingCalendarViewControlsProps) {
  function selectMode(mode: CalendarViewMode) {
    if (mode === viewMode) return;
    animateViewModeChange();
    onViewModeChange(mode);
  }

  return (
    <View style={styles.shell}>
      <View style={styles.toggleRow}>
        <Pressable
          style={[styles.toggleChip, viewMode === "month" && styles.toggleChipActive]}
          onPress={() => selectMode("month")}
          accessibilityRole="button"
          accessibilityState={{ selected: viewMode === "month" }}
        >
          <Text style={[styles.toggleText, viewMode === "month" && styles.toggleTextActive]}>Month</Text>
        </Pressable>
        <Pressable
          style={[styles.toggleChip, viewMode === "week" && styles.toggleChipActive]}
          onPress={() => selectMode("week")}
          accessibilityRole="button"
          accessibilityState={{ selected: viewMode === "week" }}
        >
          <Text style={[styles.toggleText, viewMode === "week" && styles.toggleTextActive]}>Week</Text>
        </Pressable>
      </View>

      <View style={styles.periodRow}>
        <Pressable
          onPress={() => onShiftPeriod(-1)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Previous period"
        >
          <Text style={styles.nav}>‹</Text>
        </Pressable>
        <Text style={styles.periodLabel} numberOfLines={1}>
          {periodLabel}
        </Text>
        <Pressable
          onPress={() => onShiftPeriod(1)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Next period"
        >
          <Text style={styles.nav}>›</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    gap: spacing.sm,
    width: "100%",
    maxWidth: "100%",
  },
  toggleRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  toggleChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  toggleChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  toggleText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "700",
  },
  toggleTextActive: {
    color: colors.accent,
  },
  periodRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    maxWidth: "100%",
  },
  periodLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: "700",
    flex: 1,
    minWidth: 0,
    textAlign: "center",
    marginHorizontal: spacing.xs,
  },
  nav: {
    fontSize: 28,
    lineHeight: 32,
    color: colors.accent,
    fontWeight: "700",
    paddingHorizontal: spacing.sm,
  },
});
