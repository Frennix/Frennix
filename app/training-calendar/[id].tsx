import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  deleteTrainingCalendarItem,
  getPendingInviteForCalendarItem,
  getTrainingCalendarItem,
  respondTrainingSessionInvite,
  updateTrainingCalendarItemStatus,
  getErrorMessage,
} from "@frennix/api";
import type { StoryShareMode } from "@frennix/types";
import { useAuth } from "@/providers/AuthProvider";
import { WorkoutSavedSheet } from "@/components/WorkoutSavedSheet";
import {
  calendarItemIcon,
  calendarItemLabel,
  formatSessionTime,
  statusColor,
} from "@/lib/training-calendar-utils";
import { stackBackOptions } from "@/lib/stack-navigation";
import { showAlert, confirmDelete } from "@/lib/alerts";
import {
  openTrainingCalendarCreate,
  openTrainingCalendarEdit,
} from "@/lib/training-calendar-navigation";
import { shareWorkout } from "@/lib/share-workout";
import { Button, colors, spacing, typography } from "@frennix/ui";

export default function TrainingCalendarDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = Array.isArray(id) ? id[0] : id;
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();
  const [statusLoading, setStatusLoading] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);

  const { data: item, isLoading } = useQuery({
    queryKey: ["training-calendar-item", itemId, userId],
    queryFn: () => getTrainingCalendarItem(itemId!, userId),
    enabled: Boolean(itemId && userId),
  });

  const { data: pendingInvite } = useQuery({
    queryKey: ["training-session-invite", itemId, userId],
    queryFn: () => getPendingInviteForCalendarItem(itemId!, userId),
    enabled: Boolean(itemId && userId),
  });

  const isOwner = item?.user_id === userId;
  const isPast = item ? new Date(item.ends_at ?? item.starts_at).getTime() < Date.now() : false;
  const canUpdateStatus = Boolean(isOwner && item && item.status === "scheduled" && isPast);

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: ["calendar-view", userId] });
    await queryClient.invalidateQueries({ queryKey: ["training-calendar", userId] });
    await queryClient.invalidateQueries({ queryKey: ["training-calendar-item", itemId] });
    await queryClient.invalidateQueries({ queryKey: ["training-session-invite", itemId] });
    await queryClient.invalidateQueries({ queryKey: ["training-calendar-completed", userId] });
  }

  async function handleInviteResponse(status: "accepted" | "declined" | "maybe_later") {
    if (!pendingInvite || !userId) return;
    setStatusLoading(true);
    try {
      await respondTrainingSessionInvite(pendingInvite.id, userId, status);
      await invalidate();
      showAlert(
        status === "accepted" ? "Accepted" : "Saved",
        status === "accepted"
          ? "This session is on your calendar."
          : status === "declined"
            ? "Invite declined."
            : "You can respond later from your calendar."
      );
    } catch (error) {
      showAlert("Could not respond", getErrorMessage(error));
    } finally {
      setStatusLoading(false);
    }
  }

  async function setStatus(status: "completed" | "missed" | "rescheduled") {
    if (!itemId || !userId || !item) return;
    setStatusLoading(true);
    try {
      await updateTrainingCalendarItemStatus(itemId, userId, status);
      await invalidate();
      if (status === "completed") {
        setShareVisible(true);
      } else if (status === "rescheduled") {
        openTrainingCalendarCreate({ date: item.scheduled_date.slice(0, 10) });
      }
    } catch (error) {
      showAlert("Could not update", getErrorMessage(error));
    } finally {
      setStatusLoading(false);
    }
  }

  function handleDelete() {
    if (!itemId || !userId) return;
    confirmDelete("calendar session", async () => {
      try {
        await deleteTrainingCalendarItem(itemId, userId);
        await invalidate();
        router.back();
      } catch (error) {
        showAlert("Could not delete", getErrorMessage(error));
      }
    });
  }

  async function handleShare(mode: StoryShareMode | "done") {
    if (!item || !userId) return;
    setShareLoading(true);
    try {
      if (mode !== "done") {
        await shareWorkout(
          mode,
          {
            userId,
            content: `Completed: ${item.title}`,
            workoutTypes: item.workout_type ? [item.workout_type] : ["workout_update"],
            metrics: {},
            gym: item.location,
            locationName: item.location,
            media: [],
          },
          queryClient
        );
      }
      setShareVisible(false);
      showAlert("Saved", mode === "done" ? "Workout marked complete." : "Shared your workout.");
    } catch (error) {
      showAlert("Could not share", getErrorMessage(error));
    } finally {
      setShareLoading(false);
    }
  }

  if (isLoading || !item) {
    return (
      <>
        <Stack.Screen options={stackBackOptions("Session")} />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={stackBackOptions("Session")} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.icon}>{calendarItemIcon(item.item_type)}</Text>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.type}>{calendarItemLabel(item.item_type)}</Text>
          <Text style={[styles.status, { color: statusColor(item.status) }]}>
            {item.status}
          </Text>
        </View>

        <View style={styles.metaCard}>
          <Text style={styles.metaLine}>
            {new Date(item.scheduled_date).toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </Text>
          <Text style={styles.metaLine}>{formatSessionTime(item.starts_at, item.ends_at)}</Text>
          {item.location ? <Text style={styles.metaLine}>📍 {item.location}</Text> : null}
          {item.workout_type ? <Text style={styles.metaLine}>🏋️ {item.workout_type}</Text> : null}
          {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
        </View>

        {pendingInvite ? (
          <View style={styles.actions}>
            <Text style={styles.sectionTitle}>Training invite</Text>
            <Text style={styles.inviteCopy}>
              {pendingInvite.inviter?.display_name ?? "A partner"} invited you to this session.
            </Text>
            <View style={styles.statusRow}>
              <Pressable
                style={[styles.statusButton, styles.completedButton]}
                onPress={() => void handleInviteResponse("accepted")}
                disabled={statusLoading}
              >
                <Text style={styles.statusButtonText}>Accept</Text>
              </Pressable>
              <Pressable
                style={[styles.statusButton, styles.rescheduleButton]}
                onPress={() => void handleInviteResponse("maybe_later")}
                disabled={statusLoading}
              >
                <Text style={styles.statusButtonText}>Maybe later</Text>
              </Pressable>
              <Pressable
                style={[styles.statusButton, styles.missedButton]}
                onPress={() => void handleInviteResponse("declined")}
                disabled={statusLoading}
              >
                <Text style={styles.statusButtonText}>Decline</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {canUpdateStatus ? (
          <View style={styles.actions}>
            <Text style={styles.sectionTitle}>How did it go?</Text>
            <View style={styles.statusRow}>
              <Pressable
                style={[styles.statusButton, styles.completedButton]}
                onPress={() => void setStatus("completed")}
                disabled={statusLoading}
              >
                <Text style={styles.statusButtonText}>Completed</Text>
              </Pressable>
              <Pressable
                style={[styles.statusButton, styles.missedButton]}
                onPress={() => void setStatus("missed")}
                disabled={statusLoading}
              >
                <Text style={styles.statusButtonText}>Missed</Text>
              </Pressable>
              <Pressable
                style={[styles.statusButton, styles.rescheduleButton]}
                onPress={() => void setStatus("rescheduled")}
                disabled={statusLoading}
              >
                <Text style={styles.statusButtonText}>Rescheduled</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {isOwner ? (
          <View style={styles.ownerActions}>
            <Button title="Edit session" onPress={() => openTrainingCalendarEdit(item.id)} />
            <Pressable onPress={handleDelete}>
              <Text style={styles.delete}>Delete session</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <WorkoutSavedSheet
        visible={shareVisible}
        loading={shareLoading}
        onSelect={(mode) => void handleShare(mode)}
        onClose={() => setShareVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  hero: {
    alignItems: "center",
    gap: spacing.xs,
  },
  icon: {
    fontSize: 42,
    lineHeight: 48,
  },
  title: {
    ...typography.heading,
    color: colors.text,
    fontWeight: "800",
    textAlign: "center",
  },
  type: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  status: {
    ...typography.caption,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  metaCard: {
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  metaLine: {
    ...typography.body,
    color: colors.text,
  },
  notes: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  actions: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: "800",
  },
  inviteCopy: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  statusButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
  },
  completedButton: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  missedButton: {
    borderColor: colors.danger,
  },
  rescheduleButton: {
    borderColor: colors.warning,
  },
  statusButtonText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "800",
  },
  ownerActions: {
    gap: spacing.md,
    alignItems: "center",
  },
  delete: {
    ...typography.bodySmall,
    color: colors.danger,
    fontWeight: "700",
  },
});
