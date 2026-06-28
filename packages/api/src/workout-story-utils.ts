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
  const pace_seconds_per_km =
    typeof raw.pace_seconds_per_km === "number" ? raw.pace_seconds_per_km : null;
  const elevation_meters =
    typeof raw.elevation_meters === "number" ? raw.elevation_meters : null;
  const source = typeof raw.source === "string" ? raw.source : null;
  const route_polyline = typeof raw.route_polyline === "string" ? raw.route_polyline : null;
  const location_shared = raw.location_shared === true;
  const extra =
    raw.extra && typeof raw.extra === "object"
      ? (raw.extra as Record<string, unknown>)
      : undefined;

  if (!duration_seconds && !distance_meters && !calories && !extra && !route_polyline) return null;

  return {
    duration_seconds,
    distance_meters,
    calories,
    pace_seconds_per_km,
    elevation_meters,
    source,
    route_polyline,
    location_shared,
    extra,
  };
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
  if (workoutCount === 1) {
    milestones.push({
      id: "first_workout",
      emoji: "⭐",
      label: "First Workout",
      kind: "first_workout",
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
    "first_workout",
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
