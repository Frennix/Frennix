/** Extensible workout metrics — manual entry today, wearable-ready later. */
export interface WorkoutStoryMetrics {
  duration_seconds?: number | null;
  distance_meters?: number | null;
  calories?: number | null;
  /** Future: avg_heart_rate, elevation_gain, pace, splits, etc. */
  extra?: Record<string, unknown>;
}

export type WorkoutStoryMilestoneKind =
  | "streak_7"
  | "streak_30"
  | "personal_record"
  | "goal_completed"
  | "workout_100";

export interface WorkoutStoryMilestone {
  id: string;
  emoji: string;
  label: string;
  kind: WorkoutStoryMilestoneKind;
}

/** Future-ready slide metadata — slots for music, maps, AI, wearables (not rendered yet). */
export interface WorkoutStorySlideMeta {
  /** Future: background music track id */
  musicTrackId?: string | null;
  /** Future: encoded polyline or geojson */
  routeMap?: { polyline?: string } | null;
  /** Future: wearable sync payload (Garmin, Apple Health, etc.) */
  wearable?: Record<string, unknown> | null;
  /** Future: AI-generated workout summary */
  aiSummary?: string | null;
}

export const STORY_CHALLENGE_RESPONSES = [
  { key: "join", label: "I'll Join", message: "I'll Join your next workout! 💪" },
  { key: "accepted", label: "Challenge Accepted", message: "Challenge Accepted! Let's go 🔥" },
  { key: "train", label: "Let's Train", message: "Let's Train together soon! 🏋️" },
  { key: "great", label: "Great Job", message: "Great Job on that workout! 👏" },
] as const;

export type StoryChallengeKey = (typeof STORY_CHALLENGE_RESPONSES)[number]["key"];
