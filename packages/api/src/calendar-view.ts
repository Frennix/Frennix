import type {
  CalendarView,
  CalendarViewItem,
  Challenge,
  TrainingCalendarItem,
  WorkoutEvent,
} from "@frennix/types";
import { computeWorkoutStreakFromDates } from "./streaks";
import { getTrainingCalendarItems } from "./training-calendar";
import { getPendingTrainingSessionInvites } from "./training-session-invites";
import { getWorkoutActivityDates } from "./workout-activity";
import { getSupabase } from "./supabase";

function toDateKey(iso: string): string {
  const date = new Date(iso);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function eachDateInRange(startKey: string, endKey: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${startKey}T12:00:00`);
  const end = new Date(`${endKey}T12:00:00`);

  while (cursor <= end) {
    dates.push(toDateKey(cursor.toISOString()));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function nativeToViewItem(item: TrainingCalendarItem): CalendarViewItem {
  return { ...item, is_virtual: false };
}

function buildEventVirtualItem(event: WorkoutEvent, userId: string): CalendarViewItem {
  const dateKey = toDateKey(event.starts_at);
  return {
    id: `virtual:event:${event.id}`,
    user_id: userId,
    title: event.title,
    item_type: "event",
    scheduled_date: dateKey,
    starts_at: event.starts_at,
    ends_at: null,
    workout_type: event.workout_type,
    location: event.location,
    notes: event.description,
    privacy: "friends",
    status: event.status === "cancelled" ? "missed" : "scheduled",
    linked_event_id: event.id,
    linked_challenge_id: null,
    rescheduled_to_id: null,
    source_type: "native",
    source_id: null,
    completed_post_id: null,
    completed_story_id: null,
    completed_at: null,
    timezone: "UTC",
    created_at: event.created_at,
    updated_at: event.updated_at,
    is_owner: false,
    is_virtual: true,
    virtual_kind: "event",
    deep_link: `/event/${event.id}`,
  };
}

function buildChallengeVirtualItem(
  challenge: Challenge,
  dateKey: string,
  userId: string
): CalendarViewItem {
  const dayStart = new Date(`${dateKey}T09:00:00`).toISOString();
  return {
    id: `virtual:challenge:${challenge.id}:${dateKey}`,
    user_id: userId,
    title: challenge.title,
    item_type: "challenge",
    scheduled_date: dateKey,
    starts_at: dayStart,
    ends_at: null,
    workout_type: null,
    location: null,
    notes: challenge.description,
    privacy: "friends",
    status: "scheduled",
    linked_event_id: null,
    linked_challenge_id: challenge.id,
    rescheduled_to_id: null,
    source_type: "challenge_mirror",
    source_id: challenge.id,
    completed_post_id: null,
    completed_story_id: null,
    completed_at: null,
    timezone: "UTC",
    created_at: challenge.created_at,
    updated_at: challenge.created_at,
    is_owner: false,
    is_virtual: true,
    virtual_kind: "challenge",
    deep_link: `/challenge/${challenge.id}`,
  };
}

function buildCommitmentVirtualItem(
  commitment: {
    id: string;
    commitment_text: string;
    due_at: string;
    story_id: string;
  },
  userId: string
): CalendarViewItem {
  const dateKey = toDateKey(commitment.due_at);
  return {
    id: `virtual:commitment:${commitment.id}`,
    user_id: userId,
    title: commitment.commitment_text,
    item_type: "solo_workout",
    scheduled_date: dateKey,
    starts_at: commitment.due_at,
    ends_at: null,
    workout_type: null,
    location: null,
    notes: null,
    privacy: "private",
    status: "scheduled",
    linked_event_id: null,
    linked_challenge_id: null,
    rescheduled_to_id: null,
    source_type: "story_commitment",
    source_id: commitment.story_id,
    completed_post_id: null,
    completed_story_id: null,
    completed_at: null,
    timezone: "UTC",
    created_at: commitment.due_at,
    updated_at: commitment.due_at,
    is_owner: true,
    is_virtual: true,
    virtual_kind: "story_commitment",
    deep_link: undefined,
  };
}

async function getJoinedEventProjections(
  userId: string,
  rangeStart: string,
  rangeEnd: string,
  linkedEventIds: Set<string>
): Promise<CalendarViewItem[]> {
  const { data, error } = await getSupabase()
    .from("event_attendees")
    .select(
      `
      event:events!event_attendees_event_id_fkey(
        id, title, description, workout_type, starts_at, location,
        max_attendees, status, created_by, group_id, created_at, updated_at
      )
    `
    )
    .eq("user_id", userId);

  if (error) throw error;

  const startKey = rangeStart.slice(0, 10);
  const endKey = rangeEnd.slice(0, 10);
  const items: CalendarViewItem[] = [];

  for (const row of data ?? []) {
    const event = (row as { event: WorkoutEvent | null }).event;
    if (!event || event.status === "cancelled") continue;
    if (linkedEventIds.has(event.id)) continue;

    const dateKey = toDateKey(event.starts_at);
    if (dateKey < startKey || dateKey > endKey) continue;

    items.push(buildEventVirtualItem(event, userId));
  }

  return items;
}

async function getActiveChallengeProjections(
  userId: string,
  rangeStart: string,
  rangeEnd: string,
  linkedChallengeIds: Set<string>
): Promise<CalendarViewItem[]> {
  const { data, error } = await getSupabase()
    .from("challenge_participants")
    .select(
      `
      challenge:challenges!challenge_participants_challenge_id_fkey(
        id, title, description, start_date, end_date, created_by, group_id, created_at
      )
    `
    )
    .eq("user_id", userId)
    .eq("status", "active");

  if (error) throw error;

  const startKey = rangeStart.slice(0, 10);
  const endKey = rangeEnd.slice(0, 10);
  const items: CalendarViewItem[] = [];

  for (const row of data ?? []) {
    const challenge = (row as { challenge: Challenge | null }).challenge;
    if (!challenge) continue;
    if (linkedChallengeIds.has(challenge.id)) continue;

    const challengeStart = toDateKey(challenge.start_date);
    const challengeEnd = toDateKey(challenge.end_date);
    const overlapStart = challengeStart > startKey ? challengeStart : startKey;
    const overlapEnd = challengeEnd < endKey ? challengeEnd : endKey;

    if (overlapStart > overlapEnd) continue;

    for (const dateKey of eachDateInRange(overlapStart, overlapEnd)) {
      items.push(buildChallengeVirtualItem(challenge, dateKey, userId));
    }
  }

  return items;
}

async function getStoryCommitmentProjections(
  userId: string,
  rangeStart: string,
  rangeEnd: string
): Promise<CalendarViewItem[]> {
  const { data, error } = await getSupabase()
    .from("story_workout_commitments")
    .select("id, commitment_text, due_at, story_id")
    .eq("user_id", userId)
    .is("completed_at", null)
    .not("due_at", "is", null)
    .gte("due_at", rangeStart)
    .lte("due_at", rangeEnd);

  if (error) throw error;

  return (data ?? []).map((row) =>
    buildCommitmentVirtualItem(
      {
        id: row.id as string,
        commitment_text: row.commitment_text as string,
        due_at: row.due_at as string,
        story_id: row.story_id as string,
      },
      userId
    )
  );
}

function computeWeeklyConsistency(
  nativeItems: TrainingCalendarItem[],
  weekStartKey: string,
  weekEndKey: string
) {
  let scheduled = 0;
  let completed = 0;
  let missed = 0;

  for (const item of nativeItems) {
    if (item.item_type === "rest_day") continue;
    const dateKey = item.scheduled_date.slice(0, 10);
    if (dateKey < weekStartKey || dateKey > weekEndKey) continue;

    scheduled += 1;
    if (item.status === "completed") completed += 1;
    if (item.status === "missed") missed += 1;
  }

  return { scheduled, completed, missed };
}

/**
 * Single calendar read API — native items, virtual projections, activity, invites, streak.
 */
export async function getCalendarView(
  userId: string,
  rangeStart: string,
  rangeEnd: string
): Promise<CalendarView> {
  const [nativeItems, pendingInvites, activity] = await Promise.all([
    getTrainingCalendarItems(userId, rangeStart, rangeEnd),
    getPendingTrainingSessionInvites(userId),
    getWorkoutActivityDates(userId, rangeStart, rangeEnd),
  ]);

  const linkedEventIds = new Set(
    nativeItems.map((item) => item.linked_event_id).filter((id): id is string => Boolean(id))
  );
  const linkedChallengeIds = new Set(
    nativeItems
      .map((item) => item.linked_challenge_id)
      .filter((id): id is string => Boolean(id))
  );

  const [eventProjections, challengeProjections, commitmentProjections] = await Promise.all([
    getJoinedEventProjections(userId, rangeStart, rangeEnd, linkedEventIds),
    getActiveChallengeProjections(userId, rangeStart, rangeEnd, linkedChallengeIds),
    getStoryCommitmentProjections(userId, rangeStart, rangeEnd),
  ]);

  const items = [
    ...nativeItems.map(nativeToViewItem),
    ...eventProjections,
    ...challengeProjections,
    ...commitmentProjections,
  ].sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  const activityIsoDates = activity.map((day) => `${day.date}T12:00:00.000Z`);
  const streak = computeWorkoutStreakFromDates(activityIsoDates);

  const today = new Date();
  const weekStart = new Date(today);
  const day = weekStart.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  weekStart.setDate(weekStart.getDate() + diff);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const weekly_consistency = computeWeeklyConsistency(
    nativeItems,
    toDateKey(weekStart.toISOString()),
    toDateKey(weekEnd.toISOString())
  );

  return {
    items,
    activity,
    pending_invites: pendingInvites,
    streak,
    weekly_consistency,
  };
}
