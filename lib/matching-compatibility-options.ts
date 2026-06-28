import type { SkillLevel, TrainingEnvironment, TrainingScheduleSlot } from "@frennix/types";

export const SKILL_LEVEL_OPTIONS: { value: SkillLevel; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

export const TRAINING_SCHEDULE_OPTIONS: { value: TrainingScheduleSlot; label: string }[] = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "weekend", label: "Weekend" },
];

export const TRAINING_ENVIRONMENT_OPTIONS: { value: TrainingEnvironment; label: string }[] = [
  { value: "indoor", label: "Indoor" },
  { value: "outdoor", label: "Outdoor" },
  { value: "both", label: "Indoor & outdoor" },
];

export function formatMatchScore(score: number): string {
  return `${Math.round(Math.max(0, Math.min(100, score)))}% match`;
}
