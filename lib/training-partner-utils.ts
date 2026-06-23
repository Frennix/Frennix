import type { Profile } from "@frennix/types";
import { formatActivity, formatGoal } from "@/lib/labels";

/** Supabase text[] fields must be arrays before .filter/.map — guard malformed RPC rows. */
export function coerceStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return [];
}

export function getSharedFitnessGoals(viewer: Profile, candidate: Profile): string[] {
  const viewerGoals = new Set(coerceStringArray(viewer.fitness_goals));
  return coerceStringArray(candidate.fitness_goals).filter((goal) => viewerGoals.has(goal));
}

export function getSharedActivities(viewer: Profile, candidate: Profile): string[] {
  const viewerActivities = new Set(coerceStringArray(viewer.activities));
  return coerceStringArray(candidate.activities).filter((activity) => viewerActivities.has(activity));
}

export function sharesCity(viewer: Profile, candidate: Profile): boolean {
  if (!viewer.city?.trim() || !candidate.city?.trim()) return false;
  return viewer.city.trim().toLowerCase() === candidate.city.trim().toLowerCase();
}

export function formatSharedGoalLabels(viewer: Profile, candidate: Profile): string[] {
  return getSharedFitnessGoals(viewer, candidate).map(formatGoal);
}

export function formatSharedActivityLabels(viewer: Profile, candidate: Profile): string[] {
  return getSharedActivities(viewer, candidate).map(formatActivity);
}

export function formatCandidateGoals(candidate: Profile, limit = 4): string[] {
  return coerceStringArray(candidate.fitness_goals).slice(0, limit).map(formatGoal);
}

export function formatCandidateActivities(candidate: Profile, limit = 5): string[] {
  return coerceStringArray(candidate.activities).slice(0, limit).map(formatActivity);
}
