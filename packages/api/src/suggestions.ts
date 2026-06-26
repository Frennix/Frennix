import type { Profile, SuggestedAthlete } from "@frennix/types";
import { getFollowingIds } from "./follows";
import { getBlockedIds } from "./moderation";
import { getProfile } from "./profiles";
import { getSupabase } from "./supabase";

const WORKOUT_POST_TYPES = ["workout_update", "photo", "video"] as const;
const RECENT_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function normalizeCity(city: string) {
  return city.trim().toLowerCase();
}

function intersect(a: string[] = [], b: string[] = []) {
  const setB = new Set(b);
  return a.filter((value) => setB.has(value));
}

function formatActivityLabel(activity: string) {
  return activity.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildReason(input: {
  mutualCount: number;
  sharedActivities: string[];
  sharedGoals: string[];
  sameCity: boolean;
  postCount: number;
  recentWorkouts: number;
}): string {
  const parts: string[] = [];

  if (input.mutualCount > 0) {
    parts.push(
      input.mutualCount === 1
        ? "1 mutual connection"
        : `${input.mutualCount} mutual connections`
    );
  }

  if (input.sharedActivities.length) {
    parts.push(
      input.sharedActivities.slice(0, 2).map(formatActivityLabel).join(" · ")
    );
  } else if (input.sharedGoals.length) {
    parts.push(input.sharedGoals.slice(0, 2).map(formatActivityLabel).join(" · "));
  }

  if (input.sameCity) parts.push("Near you");

  if (input.recentWorkouts >= 3) parts.push("Very active");
  else if (input.postCount >= 5) parts.push("Active athlete");

  if (!parts.length) return "Suggested for you";
  return parts.join(" · ");
}

function scoreCandidate(input: {
  sharedActivities: string[];
  sharedGoals: string[];
  sameCity: boolean;
  mutualCount: number;
  postCount: number;
  recentWorkouts: number;
}) {
  let score = 0;
  score += input.sharedActivities.length * 18;
  score += input.sharedGoals.length * 12;
  if (input.sameCity) score += 28;
  score += Math.min(input.mutualCount * 10, 50);
  score += Math.min(input.postCount, 25) * 1.5;
  if (input.recentWorkouts >= 3) score += 15;
  else if (input.recentWorkouts >= 1) score += 8;
  return score;
}

export async function getSuggestedAthletes(
  viewerId: string,
  limit = 12
): Promise<SuggestedAthlete[]> {
  const [viewer, followingIds, blockedIds] = await Promise.all([
    getProfile(viewerId),
    getFollowingIds(viewerId),
    getBlockedIds(viewerId),
  ]);

  if (!viewer) return [];

  const excludeIds = new Set([viewerId, ...followingIds, ...blockedIds]);

  const { data: candidates, error } = await getSupabase()
    .from("profiles_reader")
    .select("*")
    .eq("onboarding_complete", true)
    .eq("visibility", "public")
    .limit(120);

  if (error) throw error;

  const profiles = ((candidates ?? []) as Profile[]).filter((profile) => !excludeIds.has(profile.id));
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

  const postCounts = new Map<string, number>();
  const recentWorkouts = new Map<string, number>();
  for (const row of posts ?? []) {
    const authorId = row.author_id as string;
    postCounts.set(authorId, (postCounts.get(authorId) ?? 0) + 1);
    if ((row.created_at as string) >= recentCutoff) {
      recentWorkouts.set(authorId, (recentWorkouts.get(authorId) ?? 0) + 1);
    }
  }

  const viewerCity = viewer.city ? normalizeCity(viewer.city) : null;

  const ranked = profiles
    .map((profile) => {
      const sharedActivities = intersect(viewer.activities, profile.activities);
      const sharedGoals = intersect(viewer.fitness_goals, profile.fitness_goals);
      const sameCity = Boolean(
        viewerCity && profile.city && normalizeCity(profile.city) === viewerCity
      );
      const mutualCount = mutualCounts.get(profile.id) ?? 0;
      const postCount = postCounts.get(profile.id) ?? 0;
      const recentCount = recentWorkouts.get(profile.id) ?? 0;

      const score = scoreCandidate({
        sharedActivities,
        sharedGoals,
        sameCity,
        mutualCount,
        postCount,
        recentWorkouts: recentCount,
      });

      return {
        profile,
        score,
        mutual_count: mutualCount,
        shared_activities: sharedActivities,
        shared_goals: sharedGoals,
        reason: buildReason({
          mutualCount,
          sharedActivities,
          sharedGoals,
          sameCity,
          postCount,
          recentWorkouts: recentCount,
        }),
      } satisfies SuggestedAthlete;
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (ranked.length >= Math.min(limit, 6)) return ranked;

  const fallback = profiles
    .filter((profile) => !ranked.some((item) => item.profile.id === profile.id))
    .slice(0, limit - ranked.length)
    .map((profile) => ({
      profile,
      score: 1,
      mutual_count: mutualCounts.get(profile.id) ?? 0,
      shared_activities: intersect(viewer.activities, profile.activities),
      shared_goals: intersect(viewer.fitness_goals, profile.fitness_goals),
      reason: "Suggested athlete",
    }));

  return [...ranked, ...fallback].slice(0, limit);
}
