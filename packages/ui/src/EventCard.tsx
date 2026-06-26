import { StyleSheet, Text, View } from "react-native";
import type { WorkoutEvent } from "@frennix/types";
import { ScalePressable } from "./ScalePressable";
import { formatWorkoutTypeLabel, workoutTypeEmoji } from "./formatRelativeTime";
import { colors, radius, spacing, typography } from "./theme";

interface EventCardProps {
  event: WorkoutEvent;
  onPress?: () => void;
}

function formatEventDateTime(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function EventCard({ event, onPress }: EventCardProps) {
  const workoutLabel = event.workout_type ? formatWorkoutTypeLabel(event.workout_type) : null;
  const emoji = event.workout_type ? workoutTypeEmoji(event.workout_type) : "🏅";
  const attendeeCount = event.attendee_count ?? 0;
  const maxLabel =
    event.max_attendees != null ? `${attendeeCount}/${event.max_attendees}` : `${attendeeCount}`;

  return (
    <ScalePressable style={styles.card} onPress={onPress} disabled={!onPress}>
      <View style={styles.header}>
        <Text style={styles.emoji}>{emoji}</Text>
        <View style={styles.headerText}>
          <Text style={styles.title}>{event.title}</Text>
          {workoutLabel ? <Text style={styles.workoutType}>{workoutLabel}</Text> : null}
        </View>
        {event.joined_by_me ? (
          <View style={styles.joinedBadge}>
            <Text style={styles.joinedText}>Joined</Text>
          </View>
        ) : null}
      </View>

      {event.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {event.description}
        </Text>
      ) : null}

      <Text style={styles.datetime}>{formatEventDateTime(event.starts_at)}</Text>
      {event.location ? <Text style={styles.location}>📍 {event.location}</Text> : null}

      <View style={styles.footer}>
        <Text style={styles.attendees}>
          {maxLabel} attendee{attendeeCount === 1 ? "" : "s"}
        </Text>
        {event.is_full ? <Text style={styles.full}>Full</Text> : null}
      </View>
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  header: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  emoji: { fontSize: 28, lineHeight: 32 },
  headerText: { flex: 1, gap: 2 },
  title: { ...typography.heading, fontSize: 18, color: colors.text },
  workoutType: { ...typography.caption, color: colors.accent, fontWeight: "600" },
  joinedBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  joinedText: { ...typography.caption, color: colors.accent, fontWeight: "700" },
  description: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 20 },
  datetime: { ...typography.bodySmall, color: colors.accent, fontWeight: "600" },
  location: { ...typography.bodySmall, color: colors.textSecondary },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  attendees: { ...typography.caption, color: colors.textMuted },
  full: { ...typography.caption, color: colors.warning, fontWeight: "700" },
});
