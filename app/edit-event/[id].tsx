import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ACTIVITIES } from "@frennix/types";
import { getErrorMessage, getWorkoutEvent, updateWorkoutEvent } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { combineDateAndTime, splitIsoToDateAndTime } from "@/lib/event-datetime";
import { formatActivity } from "@/lib/labels";
import { showAlert } from "@/lib/alerts";
import { Button, Input, colors, spacing, typography } from "@frennix/ui";

export default function EditEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [workoutType, setWorkoutType] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [maxAttendees, setMaxAttendees] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { data: event } = useQuery({
    queryKey: ["workout-event", id, userId],
    queryFn: () => getWorkoutEvent(id!, userId),
    enabled: !!id && !!userId,
  });

  useEffect(() => {
    if (!event) return;
    if (event.created_by !== userId) {
      showAlert("Edit event", "Only the event creator can edit this event");
      router.back();
      return;
    }
    const parts = splitIsoToDateAndTime(event.starts_at);
    setTitle(event.title);
    setWorkoutType(event.workout_type);
    setDescription(event.description ?? "");
    setDate(parts.date);
    setTime(parts.time);
    setLocation(event.location ?? "");
    setMaxAttendees(event.max_attendees != null ? String(event.max_attendees) : "");
  }, [event, userId]);

  async function submit() {
    if (!id || !userId) return;
    const startsAt = combineDateAndTime(date, time);
    if (!startsAt) {
      setError("Enter a valid date and time");
      return;
    }

    const max = maxAttendees.trim() ? Number(maxAttendees) : null;
    if (maxAttendees.trim() && (!Number.isInteger(max) || (max ?? 0) < 1)) {
      setError("Max attendees must be a positive whole number");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await updateWorkoutEvent(id, userId, {
        title: title.trim(),
        description: description.trim() || null,
        workout_type: workoutType,
        starts_at: startsAt,
        location: location.trim() || null,
        max_attendees: max,
      });
      await queryClient.invalidateQueries({ queryKey: ["workout-events"] });
      await queryClient.invalidateQueries({ queryKey: ["workout-event", id] });
      router.back();
    } catch (e) {
      const message = getErrorMessage(e);
      setError(message);
      showAlert("Update failed", message);
    } finally {
      setLoading(false);
    }
  }

  if (!event) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Input label="Title" value={title} onChangeText={setTitle} />
      <Text style={styles.sectionLabel}>Workout type</Text>
      <View style={styles.chips}>
        {ACTIVITIES.map((activity) => (
          <Pressable
            key={activity}
            style={[styles.chip, workoutType === activity && styles.chipActive]}
            onPress={() => setWorkoutType(workoutType === activity ? null : activity)}
          >
            <Text style={[styles.chipText, workoutType === activity && styles.chipTextActive]}>
              {formatActivity(activity)}
            </Text>
          </Pressable>
        ))}
      </View>
      <Input label="Description" value={description} onChangeText={setDescription} multiline />
      <Input label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} autoCapitalize="none" />
      <Input label="Time (HH:MM)" value={time} onChangeText={setTime} autoCapitalize="none" />
      <Input label="Location" value={location} onChangeText={setLocation} />
      <Input
        label="Max attendees (optional)"
        value={maxAttendees}
        onChangeText={setMaxAttendees}
        keyboardType="number-pad"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Save changes" onPress={submit} loading={loading} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  sectionLabel: { ...typography.body, fontWeight: "600", color: colors.text },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  chipText: { ...typography.bodySmall, color: colors.textSecondary },
  chipTextActive: { color: colors.accent, fontWeight: "600" },
  error: { ...typography.bodySmall, color: colors.danger },
});
