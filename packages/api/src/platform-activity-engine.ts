import type {
  PlatformActivityCounts,
  PlatformActivityEvent,
  PlatformActivityStreamOptions,
  PlatformActivityType,
  PublishPlatformActivityInput,
} from "@frennix/types";
import { getSupabase } from "./supabase";

/**
 * Platform Activity Engine — the single publish API for all Frennix actions.
 *
 * Before creating any new tracking/analytics table, ask:
 * "Can this publish a Platform Activity Event instead?"
 */
export async function publishPlatformActivity(
  input: PublishPlatformActivityInput
): Promise<string | null> {
  const { data, error } = await getSupabase().rpc("publish_platform_activity", {
    p_user_id: input.userId,
    p_activity_type: input.activityType,
    p_source_type: input.sourceType ?? null,
    p_source_id: input.sourceId ?? null,
    p_metadata: input.metadata ?? {},
    p_occurred_at: input.occurredAt ?? new Date().toISOString(),
  });

  if (error) {
    const { error: insertError } = await getSupabase().from("platform_activity_events").insert({
      user_id: input.userId,
      activity_type: input.activityType,
      source_type: input.sourceType ?? null,
      source_id: input.sourceId ?? null,
      metadata: input.metadata ?? {},
      occurred_at: input.occurredAt ?? new Date().toISOString(),
    });

    if (insertError && insertError.code !== "23505") throw insertError;
    return null;
  }

  return (data as string | null) ?? null;
}

export async function getPlatformActivityStream(
  userId: string,
  options: PlatformActivityStreamOptions = {}
): Promise<PlatformActivityEvent[]> {
  let query = getSupabase()
    .from("platform_activity_events")
    .select("*")
    .eq("user_id", userId)
    .order("occurred_at", { ascending: false });

  if (options.rangeStart) {
    query = query.gte("occurred_at", options.rangeStart);
  }
  if (options.rangeEnd) {
    query = query.lte("occurred_at", options.rangeEnd);
  }
  if (options.activityTypes?.length) {
    query = query.in("activity_type", options.activityTypes);
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map(mapActivityRow);
}

export async function countPlatformActivity(
  userId: string,
  activityTypes: PlatformActivityType[],
  since?: string
): Promise<number> {
  let query = getSupabase()
    .from("platform_activity_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("activity_type", activityTypes);

  if (since) {
    query = query.gte("occurred_at", since);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

const LEGACY_ACTIVITY_ALIASES: Partial<Record<PlatformActivityType, PlatformActivityType[]>> = {
  event_created: ["event_hosted"],
  event_joined: ["event_attended"],
  workout_rescheduled: ["calendar_session_rescheduled"],
  workout_missed: ["calendar_session_missed"],
  workout_completed: ["calendar_session_completed"],
};

function resolveCountKeys(type: PlatformActivityType): PlatformActivityType[] {
  const aliases: PlatformActivityType[] = [type];
  for (const [canonical, legacy] of Object.entries(LEGACY_ACTIVITY_ALIASES)) {
    if (legacy?.includes(type)) {
      aliases.push(canonical as PlatformActivityType);
    }
  }
  return [...new Set(aliases)];
}

export async function getPlatformActivityCounts(
  userId: string
): Promise<PlatformActivityCounts> {
  const { data, error } = await getSupabase()
    .from("platform_activity_events")
    .select("activity_type")
    .eq("user_id", userId);

  if (error) throw error;

  const raw = new Map<string, number>();
  for (const row of data ?? []) {
    const type = row.activity_type as string;
    raw.set(type, (raw.get(type) ?? 0) + 1);
  }

  function sum(types: PlatformActivityType[]): number {
    let total = 0;
    for (const type of types) {
      for (const key of resolveCountKeys(type)) {
        total += raw.get(key) ?? 0;
      }
    }
    return total;
  }

  return {
    workout_completed: sum(["workout_completed"]),
    workout_scheduled: sum(["workout_scheduled"]),
    event_joined: sum(["event_joined"]),
    event_attended: sum(["event_attended"]),
    event_created: sum(["event_created"]),
    challenge_joined: sum(["challenge_joined"]),
    challenge_completed: sum(["challenge_completed"]),
    partner_workout_completed: sum(["partner_workout_completed"]),
    story_commitment_completed: sum(["story_commitment_completed"]),
    run_club_participation: sum(["run_club_participation"]),
    match_created: sum(["match_created"]),
    achievement_earned: sum(["achievement_earned"]),
  };
}

export async function getWeeklyWorkoutCount(userId: string): Promise<number> {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  return countPlatformActivity(userId, ["workout_completed"], weekAgo.toISOString());
}

function mapActivityRow(row: Record<string, unknown>): PlatformActivityEvent {
  const activityType =
    (row.activity_type as PlatformActivityType | undefined) ??
    (row.event_type as PlatformActivityType);

  return {
    id: row.id as string,
    user_id: row.user_id as string,
    activity_type: activityType,
    source_type: (row.source_type as string | null) ?? (row.source_table as string | null),
    source_id: (row.source_id as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    occurred_at: row.occurred_at as string,
    created_at: row.created_at as string,
  };
}

/** @deprecated Use publishPlatformActivity */
export const recordPlatformActivity = publishPlatformActivity;

/** @deprecated Use getPlatformActivityCounts */
export const getActivityEventCounts = getPlatformActivityCounts;
