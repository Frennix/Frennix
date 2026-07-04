import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import {
  getTrainingCalendarItem,
  updateTrainingCalendarItem,
  getErrorMessage,
} from "@frennix/api";
import type { TrainingCalendarItemType, TrainingCalendarPrivacy } from "@frennix/types";
import {
  TrainingCalendarSessionForm,
  type TrainingCalendarFormValues,
} from "@/components/training-calendar/TrainingCalendarSessionForm";
import { useAuth } from "@/providers/AuthProvider";
import { combineDateAndTime, splitIsoToDateAndTime } from "@/lib/event-datetime";
import { stackBackOptions } from "@/lib/stack-navigation";
import { showAlert } from "@/lib/alerts";
import { colors } from "@frennix/ui";

export default function EditTrainingCalendarItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = Array.isArray(id) ? id[0] : id;
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState<TrainingCalendarFormValues | null>(null);

  const { data: item, isLoading } = useQuery({
    queryKey: ["training-calendar-item", itemId, userId],
    queryFn: () => getTrainingCalendarItem(itemId!, userId),
    enabled: Boolean(itemId && userId),
  });

  useEffect(() => {
    if (!item) return;
    const start = splitIsoToDateAndTime(item.starts_at);
    const end = item.ends_at ? splitIsoToDateAndTime(item.ends_at) : { date: "", time: "" };
    setValues({
      title: item.title,
      itemType: item.item_type as TrainingCalendarItemType,
      date: item.scheduled_date.slice(0, 10),
      startTime: start.time || "09:00",
      endTime: end.time,
      workoutType: item.workout_type,
      location: item.location ?? "",
      notes: item.notes ?? "",
      privacy: item.privacy as TrainingCalendarPrivacy,
    });
  }, [item]);

  async function submit() {
    if (!userId || !itemId || !values || loading) return;
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
      await updateTrainingCalendarItem(itemId, userId, {
        title: values.title,
        item_type: values.itemType,
        scheduled_date: values.date,
        starts_at: startsAt,
        ends_at: endsAt,
        workout_type: values.workoutType,
        location: values.location.trim() || null,
        notes: values.notes.trim() || null,
        privacy: values.privacy,
      });
      await queryClient.invalidateQueries({ queryKey: ["calendar-view", userId] });
      await queryClient.invalidateQueries({ queryKey: ["training-calendar", userId] });
      await queryClient.invalidateQueries({ queryKey: ["training-calendar-item", itemId] });
      router.back();
    } catch (error) {
      showAlert("Could not update session", getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  if (isLoading || !values) {
    return (
      <>
        <Stack.Screen options={stackBackOptions("Edit Session")} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={stackBackOptions("Edit Session")} />
      <TrainingCalendarSessionForm
        values={values}
        loading={loading}
        submitLabel="Save changes"
        onChange={(patch) => setValues((current) => (current ? { ...current, ...patch } : current))}
        onSubmit={() => void submit()}
      />
    </>
  );
}
