import { StyleSheet, Text, View } from "react-native";
import type { CalendarDayCell } from "@/lib/training-calendar-utils";
import type { CalendarViewItem } from "@frennix/types";
import { TrainingCalendarItemCard } from "./TrainingCalendarItemCard";
import { colors, spacing, typography } from "@frennix/ui";

type TrainingCalendarWeekListProps = {
  days: CalendarDayCell[];
  onItemPress: (item: CalendarViewItem) => void;
};

export function TrainingCalendarWeekList({ days, onItemPress }: TrainingCalendarWeekListProps) {
  return (
    <View style={styles.wrap}>
      {days.map((day) => (
        <View key={day.dateKey} style={styles.daySection}>
          <View style={styles.dayHeader}>
            <Text style={[styles.dayLabel, day.isToday && styles.dayLabelToday]}>
              {day.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
            </Text>
            {day.items.length ? (
              <Text style={styles.count}>{day.items.length}</Text>
            ) : null}
          </View>
          {day.items.length ? (
            <View style={styles.items}>
              {day.items.map((item) => (
                <TrainingCalendarItemCard
                  key={item.id}
                  item={item}
                  onPress={() => onItemPress(item)}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.emptyDay}>No sessions</Text>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
    width: "100%",
    maxWidth: "100%",
  },
  daySection: {
    gap: spacing.sm,
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dayLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: "700",
  },
  dayLabelToday: {
    color: colors.accent,
  },
  count: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "700",
  },
  items: {
    gap: spacing.sm,
  },
  emptyDay: {
    ...typography.caption,
    color: colors.textMuted,
    paddingVertical: spacing.xs,
  },
});
