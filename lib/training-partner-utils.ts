import type { Profile } from "@frennix/types";
import { formatActivity, formatGoal } from "@/lib/labels";

export function getSharedFitnessGoals(viewer: Profile, candidate: Profile): string[] {
  const viewerGoals = new Set(viewer.fitness_goals ?? []);
  return (candidate.fitness_goals ?? []).filter((goal) => viewerGoals.has(goal));
}

export function getSharedActivities(viewer: Profile, candidate: Profile): string[] {
  const viewerActivities = new Set(viewer.activities ?? []);
  return (candidate.activities ?? []).filter((activity) => viewerActivities.has(activity));
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
  return (candidate.fitness_goals ?? []).slice(0, limit).map(formatGoal);
}

export function formatCandidateActivities(candidate: Profile, limit = 5): string[] {
  return (candidate.activities ?? []).slice(0, limit).map(formatActivity);
}
