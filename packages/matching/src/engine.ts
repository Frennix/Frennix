import type { MatchReason, MatchableProfile, MatchingWeights } from "@frennix/types";
import {
  formatMatchActivity,
  formatMatchEnvironment,
  formatMatchGoal,
} from "./labels";
import {
  citiesMatch,
  distanceMilesBetween,
  environmentsCompatible,
  getSharedValues,
  gymsMatch,
  isRecentlyActive,
  isSkillCompatible,
  withinDiscoveryRadius,
} from "./utils";

export interface MatchContext {
  viewerStreak?: number;
  candidateStreak?: number;
}

export function buildMatchReasons(
  viewer: MatchableProfile,
  candidate: MatchableProfile,
  weights: MatchingWeights,
  context: MatchContext = {}
): MatchReason[] {
  const reasons: MatchReason[] = [];

  const sharedGoals = getSharedValues(viewer.fitness_goals, candidate.fitness_goals);
  if (sharedGoals.length) {
    const labels = sharedGoals.map(formatMatchGoal);
    const wantsAccountability = sharedGoals.some((g) => g === "accountability_partner");
    reasons.push({
      code: "shared_goals",
      label: wantsAccountability
        ? "Both want accountability partners"
        : "Similar fitness goals",
      weight: weights.sharedGoals,
      details: labels,
    });
  }

  const sharedActivities = getSharedValues(viewer.activities, candidate.activities);
  if (sharedActivities.length) {
    const labels = sharedActivities.map(formatMatchActivity);
    const strengthLike = sharedActivities.some((a) =>
      ["weightlifting", "crossfit", "martial_arts"].includes(a)
    );
    reasons.push({
      code: "shared_activities",
      label: strengthLike
        ? "Both enjoy strength training"
        : sharedActivities.length === 1
          ? `Both enjoy ${labels[0]}`
          : "Similar workout interests",
      weight: weights.sharedActivities,
      details: labels,
    });
  }

  const distanceMiles = distanceMilesBetween(viewer, candidate);
  if (distanceMiles != null && withinDiscoveryRadius(viewer, candidate, distanceMiles)) {
    const miles = Math.max(1, Math.round(distanceMiles));
    reasons.push({
      code: "nearby_distance",
      label: `Live within ${miles} mile${miles === 1 ? "" : "s"}`,
      weight: weights.nearbyDistance,
    });
  } else if (citiesMatch(viewer, candidate)) {
    reasons.push({
      code: "same_city",
      label: `You're both in ${candidate.city?.trim() ?? "the same city"}`,
      weight: weights.sameCity,
    });
  }

  const sharedSchedules = getSharedValues(viewer.training_schedules, candidate.training_schedules);
  if (sharedSchedules.length) {
    reasons.push({
      code: "shared_schedule",
      label: "Similar workout schedule",
      weight: weights.sharedSchedule,
      details: sharedSchedules,
    });
  }

  if (isSkillCompatible(viewer, candidate)) {
    reasons.push({
      code: "skill_compatible",
      label: "Similar experience level",
      weight: weights.skillCompatible,
    });
  }

  if (gymsMatch(viewer, candidate)) {
    reasons.push({
      code: "same_gym",
      label: `You both train at ${candidate.home_gym?.trim()}`,
      weight: weights.sameGym,
    });
  }

  if (environmentsCompatible(viewer, candidate)) {
    const env = candidate.training_environment
      ? formatMatchEnvironment(candidate.training_environment)
      : "similar training environments";
    reasons.push({
      code: "shared_environment",
      label: `You both prefer ${env}`,
      weight: weights.sharedEnvironment,
    });
  }

  const viewerStreak = context.viewerStreak ?? 0;
  const candidateStreak = context.candidateStreak ?? 0;
  if (viewerStreak >= 20 && candidateStreak >= 20) {
    reasons.push({
      code: "workout_streak",
      label: "Both have a 20+ day workout streak",
      weight: weights.workoutStreak,
      details: [`${viewerStreak}`, `${candidateStreak}`],
    });
  } else if (candidateStreak >= 7) {
    reasons.push({
      code: "workout_streak",
      label: `${candidateStreak}-day workout streak`,
      weight: Math.round(weights.workoutStreak * 0.6),
    });
  }

  if (candidate.is_online) {
    reasons.push({
      code: "online_now",
      label: "Online now",
      weight: weights.onlineNow,
    });
  } else if (isRecentlyActive(candidate.last_seen_at)) {
    reasons.push({
      code: "recently_active",
      label: "Recently active on Frennix",
      weight: weights.recentlyActive,
    });
  }

  if (candidate.matching_enabled) {
    reasons.push({
      code: "discovery_active",
      label: "Open to training partners",
      weight: weights.discoveryActive,
    });
  }

  return reasons.sort((a, b) => b.weight - a.weight);
}

export function scoreFromReasons(reasons: MatchReason[]): number {
  if (!reasons.length) return 0;
  const raw = reasons.reduce((sum, reason) => sum + reason.weight, 0);
  return Math.min(100, Math.round(raw));
}

export function scoreMatch(
  viewer: MatchableProfile,
  candidate: MatchableProfile,
  weights: MatchingWeights,
  context: MatchContext = {}
): number {
  return scoreFromReasons(buildMatchReasons(viewer, candidate, weights, context));
}
