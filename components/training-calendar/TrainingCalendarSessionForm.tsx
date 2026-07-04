import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { ACTIVITIES } from "@frennix/types";
import {
  TRAINING_CALENDAR_ITEM_TYPES,
  TRAINING_CALENDAR_PRIVACY_OPTIONS,
  type TrainingCalendarItemType,
  type TrainingCalendarPrivacy,
} from "@frennix/types";
import { formatActivity } from "@/lib/labels";
import { Button, Input, colors, spacing, typography } from "@frennix/ui";

export type TrainingCalendarFormValues = {
  title: string;
  itemType: TrainingCalendarItemType;
  date: string;
  startTime: string;
  endTime: string;
  workoutType: string | null;
  location: string;
  notes: string;
  privacy: TrainingCalendarPrivacy;
};

type TrainingCalendarSessionFormProps = {
  values: TrainingCalendarFormValues;
  loading?: boolean;
  submitLabel: string;
  onChange: (patch: Partial<TrainingCalendarFormValues>) => void;
  onSubmit: () => void;
};

export function TrainingCalendarSessionForm({
  values,
  loading,
  submitLabel,
  onChange,
  onSubmit,
}: TrainingCalendarSessionFormProps) {
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Input
        label="Title"
        value={values.title}
        onChangeText={(title) => onChange({ title })}
        placeholder="Morning strength session"
        editable={!loading}
      />

      <Text style={styles.sectionLabel}>Session type</Text>
      <View style={styles.chipRow}>
        {TRAINING_CALENDAR_ITEM_TYPES.map((type) => (
          <Pressable
            key={type.value}
            style={[styles.chip, values.itemType === type.value && styles.chipActive]}
            onPress={() => onChange({ itemType: type.value })}
          >
            <Text style={[styles.chipText, values.itemType === type.value && styles.chipTextActive]}>
              {type.icon} {type.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Input
        label="Date (YYYY-MM-DD)"
        value={values.date}
        onChangeText={(date) => onChange({ date })}
        placeholder="2026-07-05"
        editable={!loading}
      />

      <View style={styles.inlineRow}>
        <View style={styles.inlineField}>
          <Input
            label="Start time"
            value={values.startTime}
            onChangeText={(startTime) => onChange({ startTime })}
            placeholder="09:00"
            editable={!loading}
          />
        </View>
        <View style={styles.inlineField}>
          <Input
            label="End time"
            value={values.endTime}
            onChangeText={(endTime) => onChange({ endTime })}
            placeholder="10:00"
            editable={!loading}
          />
        </View>
      </View>

      <Text style={styles.sectionLabel}>Workout type</Text>
      <View style={styles.chipRow}>
        {ACTIVITIES.slice(0, 8).map((activity) => (
          <Pressable
            key={activity}
            style={[styles.chip, values.workoutType === activity && styles.chipActive]}
            onPress={() =>
              onChange({ workoutType: values.workoutType === activity ? null : activity })
            }
          >
            <Text
              style={[styles.chipText, values.workoutType === activity && styles.chipTextActive]}
            >
              {formatActivity(activity)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Input
        label="Location / gym"
        value={values.location}
        onChangeText={(location) => onChange({ location })}
        placeholder="Equinox, Central Park, home gym"
        editable={!loading}
      />

      <Input
        label="Notes"
        value={values.notes}
        onChangeText={(notes) => onChange({ notes })}
        placeholder="Warm-up, focus lifts, partner meetup spot"
        editable={!loading}
        multiline
      />

      <Text style={styles.sectionLabel}>Privacy</Text>
      <View style={styles.chipRow}>
        {TRAINING_CALENDAR_PRIVACY_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            style={[styles.chip, values.privacy === option.value && styles.chipActive]}
            onPress={() => onChange({ privacy: option.value })}
          >
            <Text
              style={[styles.chipText, values.privacy === option.value && styles.chipTextActive]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Button title={submitLabel} onPress={onSubmit} loading={loading} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  sectionLabel: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontWeight: "700",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  chipText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "600",
  },
  chipTextActive: {
    color: colors.accent,
    fontWeight: "800",
  },
  inlineRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  inlineField: {
    flex: 1,
  },
});
