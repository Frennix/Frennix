import type { WorkoutStoryMetrics } from "@frennix/types";

/** Normalize workout_metrics from DB JSON. */
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

export function formatStoryDuration(seconds?: number | null): string | null {
  if (seconds == null || seconds <= 0) return null;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes} min`;
  return `${seconds}s`;
}

export function formatStoryDistance(meters?: number | null): string | null {
  if (meters == null || meters <= 0) return null;
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

export function formatStoryCalories(calories?: number | null): string | null {
  if (calories == null || calories <= 0) return null;
  return `${Math.round(calories)} cal`;
}

export function formatStoryCompletedTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
