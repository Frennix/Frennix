import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { CalendarDayCell } from "@/lib/training-calendar-utils";
import { calendarItemIcon } from "@/lib/training-calendar-utils";
import { colors, spacing, typography } from "@frennix/ui";

type TrainingCalendarMonthGridProps = {
  days: CalendarDayCell[];
  selectedDateKey: string;
  onSelectDate: (dateKey: string) => void;
};

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function chunkWeeks(days: CalendarDayCell[]): CalendarDayCell[][] {
  const weeks: CalendarDayCell[][] = [];
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }
  return weeks;
}

export function TrainingCalendarMonthGrid({
  days,
  selectedDateKey,
  onSelectDate,
}: TrainingCalendarMonthGridProps) {
  const weeks = useMemo(() => chunkWeeks(days), [days]);

  return (
    <View style={styles.wrap}>
      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label) => (
          <Text key={label} style={styles.weekday}>
            {label}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {weeks.map((week, weekIndex) => (
          <View key={`week-${weekIndex}`} style={styles.weekRow}>
            {week.map((day) => {
              const selected = day.dateKey === selectedDateKey;
              const hasItems = day.items.length > 0;
              const dots = day.items.slice(0, 3);

              return (
                <Pressable
                  key={day.dateKey}
                  style={[
                    styles.cell,
                    !day.inMonth && styles.cellMuted,
                    day.isToday && styles.cellToday,
                    selected && styles.cellSelected,
                  ]}
                  onPress={() => onSelectDate(day.dateKey)}
                >
                  <Text
                    style={[
                      styles.dayNumber,
                      !day.inMonth && styles.dayNumberMuted,
                      selected && styles.dayNumberSelected,
                    ]}
                  >
                    {day.date.getDate()}
                  </Text>
                  {hasItems || day.hasActivity ? (
                    <View style={styles.dots}>
                      {day.hasActivity ? <View style={styles.activityDot} /> : null}
                      {dots.map((item) => (
                        <Text key={item.id} style={styles.dot}>
                          {calendarItemIcon(item.item_type)}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    maxWidth: "100%",
    gap: spacing.sm,
  },
  weekdayRow: {
    flexDirection: "row",
    width: "100%",
  },
  weekday: {
    flex: 1,
    minWidth: 0,
    textAlign: "center",
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "700",
  },
  grid: {
    width: "100%",
    gap: 2,
  },
  weekRow: {
    flexDirection: "row",
    width: "100%",
  },
  cell: {
    flex: 1,
    minWidth: 0,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 2,
    gap: 2,
  },
  cellMuted: {
    opacity: 0.45,
  },
  cellToday: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  cellSelected: {
    borderRadius: 10,
    backgroundColor: colors.accentMuted,
  },
  dayNumber: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: "700",
  },
  dayNumberMuted: {
    color: colors.textMuted,
  },
  dayNumberSelected: {
    color: colors.accent,
  },
  dots: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 1,
    maxWidth: "100%",
  },
  dot: {
    fontSize: 8,
    lineHeight: 10,
  },
  activityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginRight: 2,
  },
});
