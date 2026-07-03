import type { Profile, SuggestedAthlete } from "@frennix/types";
import {
  buildCompatibilityReasons,
  buildCompatibilitySummary,
  scoreCompatibility,
  getSharedValues,
  coerceStringArray,
} from "@frennix/matching";
import { getFollowingIds } from "./follows";
import { getBlockedIds } from "./moderation";
import { getProfile } from "./profiles";
import { getSupabase } from "./supabase";

const WORKOUT_POST_TYPES = ["workout_update", "photo", "video"] as const;
const RECENT_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const CANDIDATE_POOL = 120;

function normalizeProfile(row: Profile): Profile {
  return {
    ...row,
    fitness_goals: coerceStringArray(row.fitness_goals),
    activities: coerceStringArray(row.activities),
    children_age_groups: coerceStringArray(row.children_age_groups),
    preferred_workout_times: coerceStringArray(row.preferred_workout_times),
    lifestyle_tags: coerceStringArray(row.lifestyle_tags),
  };
}

function rankCandidate(
  viewer: Profile,
  profile: Profile,
  mutualCount: number,
  recentWorkouts: number
): SuggestedAthlete {
  const sharedActivities = getSharedValues(viewer.activities, profile.activities);
  const sharedGoals = getSharedValues(viewer.fitness_goals, profile.fitness_goals);
  const context = { candidateStreak: 0, viewerStreak: 0 };
  const match_reasons = buildCompatibilityReasons(viewer, profile, undefined, context);
  const compatibility_score = scoreCompatibility(viewer, profile, undefined, context);
  let score = compatibility_score;

  if (mutualCount > 0) score = Math.min(100, score + Math.min(mutualCount * 3, 12));
  if (recentWorkouts >= 3) score = Math.min(100, score + 4);

  return {
    profile,
    score,
    compatibility_score,
    match_reasons,
    mutual_count: mutualCount,
    shared_activities: sharedActivities,
    shared_goals: sharedGoals,
    reason: buildCompatibilitySummary(match_reasons, score),
  };
}

export async function getSuggestedAthletes(
  viewerId: string,
  limit = 12
): Promise<SuggestedAthlete[]> {
  const [viewerRow, followingIds, blockedIds] = await Promise.all([
    getProfile(viewerId),
    getFollowingIds(viewerId),
    getBlockedIds(viewerId),
  ]);

  if (!viewerRow) return [];
  const viewer = normalizeProfile(viewerRow);

  const excludeIds = new Set([viewerId, ...followingIds, ...blockedIds]);

  const { data: candidates, error } = await getSupabase()
    .from("profiles_reader")
    .select("*")
    .eq("onboarding_complete", true)
    .eq("visibility", "public")
    .limit(CANDIDATE_POOL);

  if (error) throw error;

  const profiles = ((candidates ?? []) as Profile[])
    .map(normalizeProfile)
    .filter((profile) => !excludeIds.has(profile.id));

  if (!profiles.length) return [];

  const candidateIds = profiles.map((profile) => profile.id);
  const myFollowing = followingIds.filter((id) => id !== viewerId);
  const recentCutoff = new Date(Date.now() - RECENT_DAYS_MS).toISOString();

  const [{ data: secondDegree }, { data: posts }] = await Promise.all([
    myFollowing.length
      ? getSupabase()
          .from("follows")
          .select("following_id")
          .in("follower_id", myFollowing)
          .in("following_id", candidateIds)
      : Promise.resolve({ data: [] as { following_id: string }[] }),
    getSupabase()
      .from("posts")
      .select("author_id, created_at")
      .in("author_id", candidateIds)
      .in("post_type", [...WORKOUT_POST_TYPES]),
  ]);

  const mutualCounts = new Map<string, number>();
  for (const row of secondDegree ?? []) {
    const id = row.following_id as string;
    mutualCounts.set(id, (mutualCounts.get(id) ?? 0) + 1);
  }

  const recentWorkouts = new Map<string, number>();
  for (const row of posts ?? []) {
    const authorId = row.author_id as string;
    if ((row.created_at as string) >= recentCutoff) {
      recentWorkouts.set(authorId, (recentWorkouts.get(authorId) ?? 0) + 1);
    }
  }

  const ranked = profiles
    .map((profile) =>
      rankCandidate(
        viewer,
        profile,
        mutualCounts.get(profile.id) ?? 0,
        recentWorkouts.get(profile.id) ?? 0
      )
    )
    .filter((item) => item.compatibility_score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (ranked.length >= Math.min(limit, 6)) return ranked;

  const fallback = profiles
    .filter((profile) => !ranked.some((item) => item.profile.id === profile.id))
    .slice(0, limit - ranked.length)
    .map((profile) => {
      const item = rankCandidate(viewer, profile, mutualCounts.get(profile.id) ?? 0, 0);
      return {
        ...item,
        score: Math.max(item.score, 1),
        compatibility_score: Math.max(item.compatibility_score, 1),
        reason: item.reason || "Suggested athlete",
      };
    });

  return [...ranked, ...fallback].slice(0, limit);
}

/** Score a single profile pair client-side (profiles, Discover detail). */
export function scoreProfileCompatibility(viewer: Profile, candidate: Profile): SuggestedAthlete {
  const v = normalizeProfile(viewer);
  const c = normalizeProfile(candidate);
  const item = rankCandidate(v, c, 0, 0);
  return item;
}
