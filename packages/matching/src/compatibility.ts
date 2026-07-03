/**
 * Lifestyle Compatibility Engine — fitness + lifestyle scoring for Discover and profiles.
 *
 * Extensible via lifestyle_tags[] on profiles (future: college_student, shift_worker, …).
 * Parent-specific columns remain first-class; tags scale to any future lifestyle category.
 */
import type { MatchReason, MatchableProfile, MatchingWeights } from "@frennix/types";
import { buildMatchReasons, scoreFromReasons, type MatchContext } from "./engine";
import {
  formatLifestyleTime,
  formatMatchActivity,
} from "./labels";
import { getSharedValues, distanceMilesBetween, withinDiscoveryRadius } from "./utils";

/** Lifestyle dimension weights — merged with fitness weights in compatibility scoring. */
export interface LifestyleWeights {
  sharedPreferredTimes: number;
  bothParents: number;
  sharedChildAgeGroups: number;
  kidFriendlyMatch: number;
  parentPartnerIntent: number;
  sharedLifestyleTags: number;
}

export const DEFAULT_LIFESTYLE_WEIGHTS: LifestyleWeights = {
  sharedPreferredTimes: 16,
  bothParents: 12,
  sharedChildAgeGroups: 14,
  kidFriendlyMatch: 10,
  parentPartnerIntent: 12,
  sharedLifestyleTags: 10,
};

export type CompatibilityWeights = MatchingWeights & LifestyleWeights;

export const DEFAULT_COMPATIBILITY_WEIGHTS: CompatibilityWeights = {
  sharedActivities: 28,
  sharedGoals: 22,
  sameCity: 14,
  nearbyDistance: 20,
  recentlyActive: 8,
  onlineNow: 4,
  sharedSchedule: 12,
  skillCompatible: 10,
  sameGym: 10,
  sharedEnvironment: 6,
  workoutStreak: 8,
  discoveryActive: 2,
  ...DEFAULT_LIFESTYLE_WEIGHTS,
};

const CHILD_AGE_LABELS: Record<string, string> = {
  infant: "infants",
  toddler: "toddlers",
  elementary: "elementary-age kids",
  middle_school: "middle schoolers",
  teen: "teens",
  adult_children: "adult children",
};

function buildLifestyleReasons(
  viewer: MatchableProfile,
  candidate: MatchableProfile,
  weights: LifestyleWeights
): MatchReason[] {
  const reasons: MatchReason[] = [];

  const sharedTimes = getSharedValues(
    viewer.preferred_workout_times,
    candidate.preferred_workout_times
  );
  if (sharedTimes.length) {
    const labels = sharedTimes.map(formatLifestyleTime);
    const morningSlots = ["early_morning", "mid_morning"];
    const isMorning =
      sharedTimes.some((t) => morningSlots.includes(t)) &&
      sharedTimes.every((t) => morningSlots.includes(t) || t === "lunch");
    reasons.push({
      code: "shared_preferred_times",
      label: isMorning
        ? "Both work out in the mornings"
        : sharedTimes.length === 1
          ? `Both prefer ${labels[0]} workouts`
          : `You share ${sharedTimes.length} preferred workout times`,
      weight: weights.sharedPreferredTimes,
      details: labels,
    });
  }

  if (viewer.parent_status === "parent" && candidate.parent_status === "parent") {
    reasons.push({
      code: "both_parents",
      label: "Both are parents",
      weight: weights.bothParents,
    });
  }

  const sharedAges = getSharedValues(
    viewer.children_age_groups,
    candidate.children_age_groups
  );
  if (sharedAges.length) {
    const ageLabel = CHILD_AGE_LABELS[sharedAges[0]!] ?? sharedAges[0]!.replace(/_/g, " ");
    reasons.push({
      code: "shared_child_ages",
      label:
        sharedAges.length === 1 && sharedAges[0] === "toddler"
          ? "Both have toddlers"
          : sharedAges.length === 1
            ? `Both have ${ageLabel}`
            : `You share ${sharedAges.length} children age groups`,
      weight: weights.sharedChildAgeGroups,
      details: sharedAges,
    });
  }

  if (viewer.kid_friendly_workouts === true && candidate.kid_friendly_workouts === true) {
    reasons.push({
      code: "kid_friendly_match",
      label: "Both open to kid-friendly workouts",
      weight: weights.kidFriendlyMatch,
    });
  }

  if (
    viewer.looking_for_parent_partner === true &&
    candidate.looking_for_parent_partner === true
  ) {
    reasons.push({
      code: "parent_partner_intent",
      label: "Both looking for a parent training partner",
      weight: weights.parentPartnerIntent,
    });
  }

  const sharedTags = getSharedValues(viewer.lifestyle_tags, candidate.lifestyle_tags);
  if (sharedTags.length) {
    reasons.push({
      code: "shared_lifestyle_tags",
      label: "Similar lifestyle",
      weight: weights.sharedLifestyleTags,
      details: sharedTags,
    });
  }

  const distanceMiles = distanceMilesBetween(viewer, candidate);
  if (
    distanceMiles != null &&
    distanceMiles <= 5 &&
    withinDiscoveryRadius(viewer, candidate, distanceMiles)
  ) {
    const miles = Math.max(1, Math.round(distanceMiles));
    reasons.push({
      code: "nearby_distance",
      label: `Live within ${miles} mile${miles === 1 ? "" : "s"}`,
      weight: 0,
    });
  }

  const sharedActivities = getSharedValues(viewer.activities, candidate.activities);
  if (sharedActivities.length) {
    const primary = formatMatchActivity(sharedActivities[0]!);
    const strengthLike = sharedActivities.some((a) =>
      ["weightlifting", "crossfit", "martial_arts"].includes(a)
    );
    if (strengthLike && !reasons.some((r) => r.code === "shared_activities")) {
      reasons.push({
        code: "shared_activities",
        label: "Both enjoy strength training",
        weight: 0,
        details: sharedActivities.map(formatMatchActivity),
      });
    } else if (sharedActivities.length === 1) {
      reasons.push({
        code: "shared_activities",
        label: `Both enjoy ${primary}`,
        weight: 0,
      });
    }
  }

  const sharedGoals = getSharedValues(viewer.fitness_goals, candidate.fitness_goals);
  if (sharedGoals.some((g) => g === "accountability_partner")) {
    reasons.push({
      code: "shared_goals",
      label: "Both want accountability partners",
      weight: 0,
    });
  } else if (sharedGoals.length >= 2) {
    reasons.push({
      code: "shared_goals",
      label: "Similar fitness goals",
      weight: 0,
      details: sharedGoals,
    });
  }

  return reasons;
}

/** Full fitness + lifestyle compatibility reasons (deduped by code). */
export function buildCompatibilityReasons(
  viewer: MatchableProfile,
  candidate: MatchableProfile,
  weights: CompatibilityWeights = DEFAULT_COMPATIBILITY_WEIGHTS,
  context: MatchContext = {}
): MatchReason[] {
  const fitness = buildMatchReasons(viewer, candidate, weights, context);
  const lifestyle = buildLifestyleReasons(viewer, candidate, weights);

  const byCode = new Map<string, MatchReason>();
  for (const reason of [...fitness, ...lifestyle]) {
    const existing = byCode.get(reason.code);
    if (!existing || reason.weight > existing.weight) {
      byCode.set(reason.code, reason);
    }
  }

  return [...byCode.values()].sort((a, b) => b.weight - a.weight);
}

export function scoreCompatibility(
  viewer: MatchableProfile,
  candidate: MatchableProfile,
  weights: CompatibilityWeights = DEFAULT_COMPATIBILITY_WEIGHTS,
  context: MatchContext = {}
): number {
  return scoreFromReasons(buildCompatibilityReasons(viewer, candidate, weights, context));
}

/** Short card summary from top Frennix Match reasons. */
export function buildCompatibilitySummary(reasons: MatchReason[], score: number): string {
  if (!reasons.length) return score >= 50 ? "Suggested Frennix Match" : "";
  const top = reasons.filter((r) => r.weight > 0).slice(0, 2);
  if (top.length) return top.map((r) => r.label).join(" · ");
  return reasons[0]?.label ?? "Suggested Frennix Match";
}

export { scoreFromReasons };
