import { Pressable, StyleSheet, Text, View } from "react-native";
import type { CalendarViewItem } from "@frennix/types";
import {
  calendarItemIcon,
  formatSessionTime,
  statusColor,
} from "@/lib/training-calendar-utils";
import { colors, spacing, typography } from "@frennix/ui";

type TrainingCalendarItemCardProps = {
  item: CalendarViewItem;
  onPress?: () => void;
};

function virtualLabel(item: CalendarViewItem): string | null {
  if (!item.is_virtual) return null;
  switch (item.virtual_kind) {
    case "event":
      return "Community event";
    case "challenge":
      return "Challenge";
    case "story_commitment":
      return "Story commitment";
    default:
      return "Linked";
  }
}

export function TrainingCalendarItemCard({ item, onPress }: TrainingCalendarItemCardProps) {
  const icon = calendarItemIcon(item.item_type);
  const linked = virtualLabel(item);

  return (
    <Pressable
      style={[styles.card, { borderLeftColor: statusColor(item.status) }]}
      onPress={onPress}
    >
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.meta}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {formatSessionTime(item.starts_at, item.ends_at)}
          {item.location ? ` · ${item.location}` : ""}
        </Text>
        {linked ? <Text style={styles.linked}>{linked}</Text> : null}
      </View>
      <Text style={[styles.status, { color: statusColor(item.status) }]} numberOfLines={1}>
        {item.is_virtual ? "joined" : item.status}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    width: "100%",
    maxWidth: "100%",
  },
  icon: {
    fontSize: 22,
    lineHeight: 26,
    width: 28,
    textAlign: "center",
  },
  meta: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    ...typography.body,
    color: colors.text,
    fontWeight: "700",
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
  },
  linked: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "600",
  },
  status: {
    ...typography.caption,
    fontWeight: "700",
    textTransform: "capitalize",
    flexShrink: 0,
    maxWidth: 72,
  },
});
