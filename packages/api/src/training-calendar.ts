import type {
  CreateTrainingCalendarItemInput,
  TrainingCalendarItem,
  TrainingCalendarStatus,
  UpdateTrainingCalendarItemInput,
} from "@frennix/types";
import { getSupabase } from "./supabase";
import { evaluateUserAchievements } from "./achievement-engine";
import { publishPlatformActivity } from "./platform-activity-engine";

function mapRow(row: Record<string, unknown>, viewerId?: string): TrainingCalendarItem {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    title: row.title as string,
    item_type: row.item_type as TrainingCalendarItem["item_type"],
    scheduled_date: row.scheduled_date as string,
    starts_at: row.starts_at as string,
    ends_at: (row.ends_at as string | null) ?? null,
    workout_type: (row.workout_type as string | null) ?? null,
    location: (row.location as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    privacy: row.privacy as TrainingCalendarItem["privacy"],
    status: row.status as TrainingCalendarItem["status"],
    linked_event_id: (row.linked_event_id as string | null) ?? null,
    linked_challenge_id: (row.linked_challenge_id as string | null) ?? null,
    rescheduled_to_id: (row.rescheduled_to_id as string | null) ?? null,
    source_type: (row.source_type as TrainingCalendarItem["source_type"]) ?? "native",
    source_id: (row.source_id as string | null) ?? null,
    completed_post_id: (row.completed_post_id as string | null) ?? null,
    completed_story_id: (row.completed_story_id as string | null) ?? null,
    completed_at: (row.completed_at as string | null) ?? null,
    timezone: (row.timezone as string) ?? "UTC",
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    is_owner: viewerId ? row.user_id === viewerId : undefined,
  };
}

export async function getTrainingCalendarItems(
  userId: string,
  rangeStart: string,
  rangeEnd: string
): Promise<TrainingCalendarItem[]> {
  const { data, error } = await getSupabase()
    .from("training_calendar_items")
    .select("*")
    .gte("scheduled_date", rangeStart.slice(0, 10))
    .lte("scheduled_date", rangeEnd.slice(0, 10))
    .order("starts_at", { ascending: true });

  if (error) throw error;

  const rows = (data ?? []).filter((row) => {
    const ownerId = row.user_id as string;
    if (ownerId === userId) return true;
    return row.privacy === "public";
  });

  const participantItemIds = new Set<string>();
  const { data: participantRows } = await getSupabase()
    .from("training_session_participants")
    .select("calendar_item_id")
    .eq("user_id", userId);

  for (const row of participantRows ?? []) {
    participantItemIds.add(row.calendar_item_id as string);
  }

  const mergedIds = new Set(rows.map((row) => row.id as string));
  const missingParticipantIds = [...participantItemIds].filter((id) => !mergedIds.has(id));

  if (missingParticipantIds.length) {
    const { data: extraRows, error: extraError } = await getSupabase()
      .from("training_calendar_items")
      .select("*")
      .in("id", missingParticipantIds)
      .gte("scheduled_date", rangeStart.slice(0, 10))
      .lte("scheduled_date", rangeEnd.slice(0, 10));

    if (extraError) throw extraError;
    rows.push(...(extraRows ?? []));
  }

  return rows
    .map((row) => mapRow(row as Record<string, unknown>, userId))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

export async function getTrainingCalendarItem(
  itemId: string,
  viewerId: string
): Promise<TrainingCalendarItem | null> {
  const { data, error } = await getSupabase()
    .from("training_calendar_items")
    .select("*")
    .eq("id", itemId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return mapRow(data as Record<string, unknown>, viewerId);
}

export async function createTrainingCalendarItem(
  input: CreateTrainingCalendarItemInput
): Promise<TrainingCalendarItem> {
  const sourceType = input.source_type ?? (input.invitee_id ? "story_invite" : "native");

  const { data, error } = await getSupabase()
    .from("training_calendar_items")
    .insert({
      user_id: input.user_id,
      title: input.title.trim(),
      item_type: input.item_type,
      scheduled_date: input.scheduled_date,
      starts_at: input.starts_at,
      ends_at: input.ends_at ?? null,
      workout_type: input.workout_type ?? null,
      location: input.location ?? null,
      notes: input.notes ?? null,
      privacy: input.privacy ?? "private",
      linked_event_id: input.linked_event_id ?? null,
      linked_challenge_id: input.linked_challenge_id ?? null,
      source_type: sourceType,
      source_id: input.source_id ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;

  const itemId = data.id as string;

  await getSupabase().from("training_session_participants").insert({
    calendar_item_id: itemId,
    user_id: input.user_id,
    role: "owner",
  });

  if (input.invitee_id && input.invitee_id !== input.user_id) {
    await getSupabase().from("training_session_invites").insert({
      calendar_item_id: itemId,
      inviter_id: input.user_id,
      invitee_id: input.invitee_id,
    });
  }

  return mapRow(data as Record<string, unknown>, input.user_id);
}

export async function updateTrainingCalendarItem(
  itemId: string,
  userId: string,
  patch: UpdateTrainingCalendarItemInput
): Promise<TrainingCalendarItem> {
  const updateBody: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (patch.title !== undefined) updateBody.title = patch.title.trim();
  if (patch.item_type !== undefined) updateBody.item_type = patch.item_type;
  if (patch.scheduled_date !== undefined) updateBody.scheduled_date = patch.scheduled_date;
  if (patch.starts_at !== undefined) updateBody.starts_at = patch.starts_at;
  if (patch.ends_at !== undefined) updateBody.ends_at = patch.ends_at;
  if (patch.workout_type !== undefined) updateBody.workout_type = patch.workout_type;
  if (patch.location !== undefined) updateBody.location = patch.location;
  if (patch.notes !== undefined) updateBody.notes = patch.notes;
  if (patch.privacy !== undefined) updateBody.privacy = patch.privacy;
  if (patch.linked_event_id !== undefined) updateBody.linked_event_id = patch.linked_event_id;
  if (patch.linked_challenge_id !== undefined) {
    updateBody.linked_challenge_id = patch.linked_challenge_id;
  }

  const { data, error } = await getSupabase()
    .from("training_calendar_items")
    .update(updateBody)
    .eq("id", itemId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw error;
  return mapRow(data as Record<string, unknown>, userId);
}

export async function deleteTrainingCalendarItem(itemId: string, userId: string): Promise<void> {
  await publishPlatformActivity({
    userId,
    activityType: "workout_cancelled",
    sourceType: "training_calendar_items",
    sourceId: itemId,
  }).catch(() => undefined);

  const { error } = await getSupabase()
    .from("training_calendar_items")
    .delete()
    .eq("id", itemId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function updateTrainingCalendarItemStatus(
  itemId: string,
  userId: string,
  status: TrainingCalendarStatus,
  options?: {
    rescheduledToId?: string | null;
    completedPostId?: string | null;
    completedStoryId?: string | null;
  }
): Promise<TrainingCalendarItem> {
  const updateBody: Record<string, unknown> = {
    status,
    rescheduled_to_id: options?.rescheduledToId ?? null,
    updated_at: new Date().toISOString(),
  };

  if (options?.completedPostId !== undefined) {
    updateBody.completed_post_id = options.completedPostId;
  }
  if (options?.completedStoryId !== undefined) {
    updateBody.completed_story_id = options.completedStoryId;
  }

  const { data, error } = await getSupabase()
    .from("training_calendar_items")
    .update(updateBody)
    .eq("id", itemId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw error;
  const item = mapRow(data as Record<string, unknown>, userId);

  if (status === "completed" || status === "missed") {
    await evaluateUserAchievements(userId).catch(() => undefined);
  }

  return item;
}

/** @deprecated Use getWorkoutActivityIsoDates from workout-activity.ts */
export async function getCompletedTrainingDates(userId: string, limit = 90): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from("training_calendar_items")
    .select("starts_at, completed_at")
    .eq("user_id", userId)
    .eq("status", "completed")
    .neq("item_type", "rest_day")
    .order("starts_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(
    (row) => (row.completed_at as string | null) ?? (row.starts_at as string)
  );
}
