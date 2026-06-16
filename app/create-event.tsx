import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ACTIVITIES } from "@frennix/types";
import { createWorkoutEvent, getErrorMessage } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { combineDateAndTime, defaultEventDate } from "@/lib/event-datetime";
import { formatActivity } from "@/lib/labels";
import { SubmitStatusBanner } from "@/components/SubmitStatusBanner";
import { useSuccessSubmit } from "@/lib/useSuccessSubmit";
import { Button, Input, colors, spacing, typography } from "@frennix/ui";

export default function CreateEventScreen() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [workoutType, setWorkoutType] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(defaultEventDate());
  const [time, setTime] = useState("09:00");
  const [location, setLocation] = useState("");
  const [maxAttendees, setMaxAttendees] = useState("");
  const [error, setError] = useState("");
  const { isLocked, isSubmitting, isSuccess, submitWithSuccess } = useSuccessSubmit();

  async function submit() {
    if (!session?.user.id || isLocked) return;
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    const startsAt = combineDateAndTime(date, time);
    if (!startsAt) {
      setError("Enter a valid date (YYYY-MM-DD) and time (HH:MM)");
      return;
    }

    const max = maxAttendees.trim() ? Number(maxAttendees) : null;
    if (maxAttendees.trim() && (!Number.isInteger(max) || (max ?? 0) < 1)) {
      setError("Max attendees must be a positive whole number");
      return;
    }

    setError("");
    try {
      await submitWithSuccess(
        async () => {
          const event = await createWorkoutEvent({
            title: title.trim(),
            description: description.trim() || null,
            workout_type: workoutType,
            starts_at: startsAt,
            location: location.trim() || null,
            max_attendees: max,
            created_by: session.user.id,
          });
          await queryClient.invalidateQueries({ queryKey: ["workout-events"] });
          return event;
        },
        (event) => router.replace(`/event/${event.id}`)
      );
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Input
        label="Title"
        value={title}
        onChangeText={setTitle}
        placeholder="Sunrise run at the park"
        editable={!isLocked}
      />

      <Text style={styles.sectionLabel}>Workout type</Text>
      <View style={styles.chips}>
        {ACTIVITIES.map((activity) => (
          <Pressable
            key={activity}
            style={[styles.chip, workoutType === activity && styles.chipActive]}
            onPress={() => setWorkoutType(workoutType === activity ? null : activity)}
            disabled={isLocked}
          >
            <Text style={[styles.chipText, workoutType === activity && styles.chipTextActive]}>
              {formatActivity(activity)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Input
        label="Description"
        value={description}
        onChangeText={setDescription}
        multiline
        placeholder="What to expect, pace, gear, meetup spot..."
        editable={!isLocked}
      />

      <Input
        label="Date (YYYY-MM-DD)"
        value={date}
        onChangeText={setDate}
        autoCapitalize="none"
        editable={!isLocked}
      />
      <Input
        label="Time (HH:MM)"
        value={time}
        onChangeText={setTime}
        autoCapitalize="none"
        editable={!isLocked}
      />
      <Input
        label="Location"
        value={location}
        onChangeText={setLocation}
        placeholder="Central Park, NYC"
        editable={!isLocked}
      />
      <Input
        label="Max attendees (optional)"
        value={maxAttendees}
        onChangeText={setMaxAttendees}
        keyboardType="number-pad"
        placeholder="20"
        editable={!isLocked}
      />

      <SubmitStatusBanner
        isSubmitting={isSubmitting}
        isSuccess={isSuccess}
        submittingLabel="Creating event…"
        successLabel="Event created! Opening your event…"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        title={isSuccess ? "Event created!" : "Create event"}
        loadingTitle="Creating…"
        onPress={submit}
        loading={isSubmitting}
        disabled={isLocked}
      />
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
