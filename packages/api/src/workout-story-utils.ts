import type { WorkoutStoryMetrics, WorkoutStoryMilestone } from "@frennix/types";

export function normalizeWorkoutStoryMetrics(
  raw: WorkoutStoryMetrics | Record<string, unknown> | null | undefined
): WorkoutStoryMetrics | null {
  if (!raw || typeof raw !== "object") return null;

  const duration_seconds =
    typeof raw.duration_seconds === "number" ? raw.duration_seconds : null;
  const distance_meters =
    typeof raw.distance_meters === "number" ? raw.distance_meters : null;
  const calories = typeof raw.calories === "number" ? raw.calories : null;
  const extra =
    raw.extra && typeof raw.extra === "object"
      ? (raw.extra as Record<string, unknown>)
      : undefined;

  if (!duration_seconds && !distance_meters && !calories && !extra) return null;

  return { duration_seconds, distance_meters, calories, extra };
}

export function computeStoryMilestones(input: {
  streak: number;
  workoutCount: number;
  storyMilestoneFlags?: string[];
}): WorkoutStoryMilestone[] {
  const { streak, workoutCount, storyMilestoneFlags = [] } = input;
  const milestones: WorkoutStoryMilestone[] = [];

  if (storyMilestoneFlags.includes("personal_record")) {
    milestones.push({
      id: "personal_record",
      emoji: "🏆",
      label: "New Personal Record",
      kind: "personal_record",
    });
  }
  if (storyMilestoneFlags.includes("goal_completed")) {
    milestones.push({
      id: "goal_completed",
      emoji: "🎯",
      label: "Goal Completed",
      kind: "goal_completed",
    });
  }
  if (workoutCount === 100) {
    milestones.push({
      id: "workout_100",
      emoji: "💯",
      label: "100th Workout",
      kind: "workout_100",
    });
  }
  if (streak === 30) {
    milestones.push({
      id: "streak_30",
      emoji: "🔥",
      label: "30-Day Streak",
      kind: "streak_30",
    });
  }
  if (streak === 7) {
    milestones.push({
      id: "streak_7",
      emoji: "🔥",
      label: "7-Day Streak",
      kind: "streak_7",
    });
  }

  return milestones;
}

/** Primary milestone to spotlight (most impressive first). */
export function primaryStoryMilestone(
  milestones: WorkoutStoryMilestone[]
): WorkoutStoryMilestone | null {
  const priority: WorkoutStoryMilestone["kind"][] = [
    "personal_record",
    "workout_100",
    "goal_completed",
    "streak_30",
    "streak_7",
  ];
  for (const kind of priority) {
    const match = milestones.find((item) => item.kind === kind);
    if (match) return match;
  }
  return milestones[0] ?? null;
}
