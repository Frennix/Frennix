import type { ProfileAchievementDisplay, UserAchievement } from "@frennix/types";
import {
  getPlatformActivityCounts,
  getWeeklyWorkoutCount,
  publishPlatformActivity,
} from "./platform-activity-engine";
import { getWorkoutStreak } from "./workout-activity";
import { getSupabase } from "./supabase";

type AchievementRule = {
  key: string;
  check: (ctx: AchievementContext) => boolean;
};

type AchievementContext = {
  counts: Awaited<ReturnType<typeof getPlatformActivityCounts>>;
  streak: number;
  weeklyWorkouts: number;
};

const ACHIEVEMENT_RULES: AchievementRule[] = [
  { key: "first_workout", check: (c) => c.counts.workout_completed >= 1 },
  { key: "workouts_10", check: (c) => c.counts.workout_completed >= 10 },
  { key: "workouts_25", check: (c) => c.counts.workout_completed >= 25 },
  { key: "workouts_100", check: (c) => c.counts.workout_completed >= 100 },
  { key: "streak_3", check: (c) => c.streak >= 3 },
  { key: "streak_7", check: (c) => c.streak >= 7 },
  { key: "streak_30", check: (c) => c.streak >= 30 },
  { key: "first_event", check: (c) => c.counts.event_attended >= 1 },
  { key: "events_5", check: (c) => c.counts.event_attended >= 5 },
  { key: "events_10", check: (c) => c.counts.event_attended >= 10 },
  { key: "event_host_3", check: (c) => c.counts.event_created >= 3 },
  { key: "first_challenge", check: (c) => c.counts.challenge_joined >= 1 },
  { key: "challenge_champion", check: (c) => c.counts.challenge_completed >= 1 },
  { key: "partner_workouts_5", check: (c) => c.counts.partner_workout_completed >= 5 },
  { key: "partner_workouts_25", check: (c) => c.counts.partner_workout_completed >= 25 },
  { key: "commitment_kept", check: (c) => c.counts.story_commitment_completed >= 1 },
  { key: "consistency_week", check: (c) => c.weeklyWorkouts >= 4 },
  { key: "run_club_first", check: (c) => c.counts.run_club_participation >= 1 },
];

async function buildAchievementContext(userId: string): Promise<AchievementContext> {
  const [counts, streak, weeklyWorkouts] = await Promise.all([
    getPlatformActivityCounts(userId),
    getWorkoutStreak(userId),
    getWeeklyWorkoutCount(userId),
  ]);

  return { counts, streak, weeklyWorkouts };
}

/** Evaluate rules and unlock any newly earned achievements. */
export async function evaluateUserAchievements(userId: string): Promise<string[]> {
  const ctx = await buildAchievementContext(userId);

  const { data: existing, error: existingError } = await getSupabase()
    .from("user_achievements")
    .select("achievement_key")
    .eq("user_id", userId);

  if (existingError) throw existingError;

  const owned = new Set((existing ?? []).map((row) => row.achievement_key as string));
  const newlyUnlocked: string[] = [];

  for (const rule of ACHIEVEMENT_RULES) {
    if (owned.has(rule.key)) continue;
    if (!rule.check(ctx)) continue;

    const { error } = await getSupabase().from("user_achievements").insert({
      user_id: userId,
      achievement_key: rule.key,
    });

    if (!error) {
      newlyUnlocked.push(rule.key);
      owned.add(rule.key);
      await publishPlatformActivity({
        userId,
        activityType: "achievement_earned",
        sourceType: "user_achievements",
        sourceId: null,
        metadata: { achievement_key: rule.key },
      }).catch(() => undefined);
    }
  }

  return newlyUnlocked;
}

export async function getUserAchievements(userId: string): Promise<UserAchievement[]> {
  const { data, error } = await getSupabase()
    .from("user_achievements")
    .select(
      `
      user_id,
      achievement_key,
      unlocked_at,
      source_event_id,
      definition:achievement_definitions!user_achievements_achievement_key_fkey(*)
    `
    )
    .eq("user_id", userId)
    .order("unlocked_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => {
    const definition = (row as { definition: unknown }).definition;
    return {
      user_id: row.user_id as string,
      achievement_key: row.achievement_key as string,
      unlocked_at: row.unlocked_at as string,
      source_event_id: (row.source_event_id as string | null) ?? null,
      definition:
        definition && typeof definition === "object" && !Array.isArray(definition)
          ? (definition as UserAchievement["definition"])
          : undefined,
    };
  });
}

export async function getProfileAchievementDisplays(
  userId: string
): Promise<ProfileAchievementDisplay[]> {
  await evaluateUserAchievements(userId);
  const earned = await getUserAchievements(userId);

  if (earned.length) {
    return earned.map((item) => ({
      id: item.achievement_key,
      emoji: item.definition?.emoji ?? "🏅",
      label: item.definition?.label ?? item.achievement_key,
      description: item.definition?.description ?? "",
      unlocked_at: item.unlocked_at,
    }));
  }

  return [];
}
