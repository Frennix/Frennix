import { useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { createTrainingCalendarItem, getErrorMessage } from "@frennix/api";
import type { CreateTrainingCalendarItemInput, TrainingCalendarItemType, TrainingCalendarPrivacy } from "@frennix/types";
import {
  TrainingCalendarSessionForm,
  type TrainingCalendarFormValues,
} from "@/components/training-calendar/TrainingCalendarSessionForm";
import { useAuth } from "@/providers/AuthProvider";
import { combineDateAndTime, defaultEventDate } from "@/lib/event-datetime";
import { stackBackOptions } from "@/lib/stack-navigation";
import { showAlert } from "@/lib/alerts";
import { colors, spacing, typography } from "@frennix/ui";

function paramValue(value: string | string[] | undefined): string {
  if (value == null) return "";
  return Array.isArray(value) ? value[0] ?? "" : value;
}

export default function CreateTrainingCalendarItemScreen() {
  const params = useLocalSearchParams<{
    partnerId?: string;
    partnerUsername?: string;
    workoutType?: string;
    date?: string;
    fromStory?: string;
    sourceType?: string;
    storyId?: string;
  }>();
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const [values, setValues] = useState<TrainingCalendarFormValues>(() => ({
    title:
      params.fromStory === "1" && paramValue(params.partnerUsername)
        ? `Workout with @${paramValue(params.partnerUsername)}`
        : "",
    itemType: (paramValue(params.partnerId) ? "partner_workout" : "solo_workout") as TrainingCalendarItemType,
    date: paramValue(params.date) || defaultEventDate(),
    startTime: "09:00",
    endTime: "10:00",
    workoutType: paramValue(params.workoutType) || null,
    location: "",
    notes: "",
    privacy: "friends",
  }));

  const partnerId = paramValue(params.partnerId) || null;
  const fromStoryHint =
    params.fromStory === "1"
      ? "Scheduling from a story — this session will appear on your Training Calendar."
      : null;

  async function submit() {
    if (!userId || loading) return;
    if (!values.title.trim()) {
      showAlert("Missing title", "Add a session title.");
      return;
    }

    const startsAt = combineDateAndTime(values.date, values.startTime);
    if (!startsAt) {
      showAlert("Invalid time", "Enter a valid date and start time.");
      return;
    }

    const endsAt = values.endTime.trim()
      ? combineDateAndTime(values.date, values.endTime)
      : null;

    setLoading(true);
    try {
      await createTrainingCalendarItem({
        user_id: userId,
        title: values.title,
        item_type: values.itemType,
        scheduled_date: values.date,
        starts_at: startsAt,
        ends_at: endsAt,
        workout_type: values.workoutType,
        location: values.location.trim() || null,
        notes: values.notes.trim() || null,
        privacy: values.privacy as TrainingCalendarPrivacy,
        invitee_id: partnerId,
        source_type:
          (paramValue(params.sourceType) as CreateTrainingCalendarItemInput["source_type"]) ||
          (partnerId ? "story_invite" : "native"),
        source_id: paramValue(params.storyId) || null,
      });
      await queryClient.invalidateQueries({ queryKey: ["calendar-view", userId] });
      router.replace("/(tabs)/events");
    } catch (error) {
      showAlert("Could not create session", getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Stack.Screen options={stackBackOptions("Schedule Training")} />
      <TrainingCalendarSessionForm
        values={values}
        loading={loading}
        submitLabel="Add to calendar"
        onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
        onSubmit={() => void submit()}
      />
      {fromStoryHint ? (
        <View style={styles.hintWrap}>
          <Text style={styles.hint}>{fromStoryHint}</Text>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  hintWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
