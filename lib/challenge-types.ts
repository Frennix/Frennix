import type { ChallengeType } from "@frennix/types";

export const CHALLENGE_TYPE_OPTIONS: { value: ChallengeType; label: string; emoji: string }[] = [
  { value: "running", label: "Running", emoji: "🏃" },
  { value: "walking", label: "Walking", emoji: "🚶" },
  { value: "cycling", label: "Cycling", emoji: "🚴" },
  { value: "strength", label: "Strength", emoji: "💪" },
  { value: "weight_loss", label: "Weight Loss", emoji: "⚖️" },
  { value: "steps", label: "Steps", emoji: "👟" },
  { value: "workout_streak", label: "Workout Streak", emoji: "🔥" },
  { value: "custom", label: "Custom", emoji: "✨" },
];

export function challengeTypeLabel(type: ChallengeType | undefined | null): string {
  if (!type) return "Challenge";
  return CHALLENGE_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? "Challenge";
}

export function challengeTypeEmoji(type: ChallengeType | undefined | null): string {
  if (!type) return "🎯";
  return CHALLENGE_TYPE_OPTIONS.find((o) => o.value === type)?.emoji ?? "🎯";
}

export function challengeProgressDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)) + 1);
}
