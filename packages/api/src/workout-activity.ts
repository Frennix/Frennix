import type { WorkoutActivityDay, WorkoutActivitySource } from "@frennix/types";
import { computeWorkoutStreakFromDates } from "./streaks";
import { getSupabase } from "./supabase";

function toLocalDateKey(iso: string): string {
  const date = new Date(iso);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function mergeActivityDay(
  map: Map<string, WorkoutActivityDay>,
  dateKey: string,
  source: WorkoutActivitySource,
  primaryId?: string
) {
  const existing = map.get(dateKey);
  if (existing) {
    if (!existing.sources.includes(source)) {
      existing.sources.push(source);
    }
    if (!existing.primary_id && primaryId) {
      existing.primary_id = primaryId;
    }
    return;
  }
  map.set(dateKey, {
    date: dateKey,
    sources: [source],
    primary_id: primaryId,
  });
}

/**
 * Single workout activity/history layer — posts, calendar completions, story commitments.
 * Used for streak, profile stats, and calendar completed-day dots.
 */
export async function getWorkoutActivityDates(
  userId: string,
  rangeStart?: string,
  rangeEnd?: string
): Promise<WorkoutActivityDay[]> {
  const startKey = rangeStart?.slice(0, 10);
  const endKey = rangeEnd?.slice(0, 10);

  const [postsRes, calendarRes, commitmentsRes] = await Promise.all([
    getSupabase()
      .from("posts")
      .select("id, created_at")
      .eq("author_id", userId)
      .in("post_type", ["workout_update", "photo", "video"])
      .order("created_at", { ascending: false })
      .limit(200),
    getSupabase()
      .from("training_calendar_items")
      .select("id, starts_at, completed_at, status")
      .eq("user_id", userId)
      .eq("status", "completed")
      .neq("item_type", "rest_day")
      .order("starts_at", { ascending: false })
      .limit(200),
    getSupabase()
      .from("story_workout_commitments")
      .select("id, completed_at")
      .eq("user_id", userId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(100),
  ]);

  const map = new Map<string, WorkoutActivityDay>();

  if (!postsRes.error) {
    for (const row of postsRes.data ?? []) {
      const dateKey = toLocalDateKey(row.created_at as string);
      if (startKey && dateKey < startKey) continue;
      if (endKey && dateKey > endKey) continue;
      mergeActivityDay(map, dateKey, "post", row.id as string);
    }
  }

  if (!calendarRes.error) {
    for (const row of calendarRes.data ?? []) {
      const iso = (row.completed_at as string | null) ?? (row.starts_at as string);
      const dateKey = toLocalDateKey(iso);
      if (startKey && dateKey < startKey) continue;
      if (endKey && dateKey > endKey) continue;
      mergeActivityDay(map, dateKey, "calendar", row.id as string);
    }
  }

  if (!commitmentsRes.error) {
    for (const row of commitmentsRes.data ?? []) {
      const dateKey = toLocalDateKey(row.completed_at as string);
      if (startKey && dateKey < startKey) continue;
      if (endKey && dateKey > endKey) continue;
      mergeActivityDay(map, dateKey, "commitment", row.id as string);
    }
  }

  return [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
}

/** ISO timestamps for streak calculation from unified activity layer. */
export async function getWorkoutActivityIsoDates(userId: string, limit = 120): Promise<string[]> {
  const activity = await getWorkoutActivityDates(userId);
  const dates: string[] = [];

  for (const day of activity.slice(0, limit)) {
    dates.push(`${day.date}T12:00:00.000Z`);
  }

  return dates;
}

export async function getWorkoutStreak(userId: string): Promise<number> {
  const isoDates = await getWorkoutActivityIsoDates(userId);
  return computeWorkoutStreakFromDates(isoDates);
}
