import type { Profile } from "./index";

/** Skill level for training partner compatibility. */
export type SkillLevel = "beginner" | "intermediate" | "advanced";

/** When someone prefers to train. */
export type TrainingScheduleSlot = "morning" | "afternoon" | "evening" | "weekend";

/** Indoor / outdoor training preference. */
export type TrainingEnvironment = "indoor" | "outdoor" | "both";

/** Machine-readable reason codes — extend as new dimensions ship. */
export type MatchReasonCode =
  | "shared_goals"
  | "shared_activities"
  | "same_city"
  | "nearby_distance"
  | "recently_active"
  | "online_now"
  | "shared_schedule"
  | "skill_compatible"
  | "same_gym"
  | "shared_environment"
  | "workout_streak"
  | "discovery_active";

/** Human-readable explanation shown on match cards. */
export interface MatchReason {
  code: MatchReasonCode;
  label: string;
  weight: number;
  details?: string[];
}

/** Extended profile fields used by the matching engine (optional until collected in UI). */
export interface MatchingProfileFields {
  skill_level?: SkillLevel | null;
  training_schedules?: TrainingScheduleSlot[];
  home_gym?: string | null;
  training_environment?: TrainingEnvironment | null;
  discovery_radius_miles?: number | null;
  latitude?: number | null;
  longitude?: number | null;
}

export type MatchableProfile = Profile & MatchingProfileFields;

/** Candidate returned from the matching API with score + explainability. */
export interface MatchCandidate extends MatchableProfile {
  match_score: number;
  match_reasons: MatchReason[];
  workout_streak: number;
}

/** Tunable weights for the scoring engine (version for A/B later). */
export interface MatchingWeights {
  sharedActivities: number;
  sharedGoals: number;
  sameCity: number;
  nearbyDistance: number;
  recentlyActive: number;
  onlineNow: number;
  sharedSchedule: number;
  skillCompatible: number;
  sameGym: number;
  sharedEnvironment: number;
  workoutStreak: number;
  discoveryActive: number;
}

export const DEFAULT_MATCHING_WEIGHTS: MatchingWeights = {
  sharedActivities: 30,
  sharedGoals: 25,
  sameCity: 18,
  nearbyDistance: 22,
  recentlyActive: 12,
  onlineNow: 8,
  sharedSchedule: 15,
  skillCompatible: 10,
  sameGym: 14,
  sharedEnvironment: 8,
  workoutStreak: 12,
  discoveryActive: 4,
};

export const TRAINING_SCHEDULE_SLOTS = [
  "morning",
  "afternoon",
  "evening",
  "weekend",
] as const satisfies readonly TrainingScheduleSlot[];

export const SKILL_LEVELS = ["beginner", "intermediate", "advanced"] as const satisfies readonly SkillLevel[];

export const TRAINING_ENVIRONMENTS = ["indoor", "outdoor", "both"] as const satisfies readonly TrainingEnvironment[];
