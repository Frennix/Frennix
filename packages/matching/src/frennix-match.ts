/**
 * Frennix Match — centralized branding and display formatting.
 *
 * Scoring logic lives in compatibility.ts / engine.ts; this module owns all
 * user-facing copy, match levels, and extensibility metadata for future factors.
 */

export const FRENIX_MATCH_BRAND = {
  name: "Frennix Match",
  tooltipTitle: "Frennix Match",
  tooltip:
    "Frennix Match measures how compatible two users are based on their fitness goals, workout preferences, workout schedule, lifestyle, location, and other factors to help you find training partners you're most likely to build lasting fitness connections with.",
  sections: {
    whyGreat: "Why You're a Great Frennix Match",
    why: "Why You're a Frennix Match",
    /** Minimum score filter — used inside Lifestyle Filters UI. */
    filterMinLabel: "Minimum Frennix Match",
    discoverSuggested: "Suggested athletes",
    discoverSuggestedBody:
      "Ranked by Frennix Match — fitness goals, interests, experience, schedule, lifestyle, and location.",
  },
  explainer: {
    title: "What is Frennix Match?",
    lead:
      "Frennix Match is our proprietary compatibility system that recommends training partners based on multiple factors—not just one.",
    factorsHeading: "Your score considers things like:",
    factors: [
      "Fitness goals",
      "Workout interests",
      "Experience level",
      "Workout schedule",
      "Lifestyle preferences",
      "Distance",
      "Activity preferences",
    ],
    closing:
      "The goal is to help you find training partners who are more likely to fit both your fitness journey and your everyday life.",
    dismissLabel: "Got it",
  },
} as const;

/**
 * Future scoring dimensions — add weights + reason builders without rebranding.
 * @see buildCompatibilityReasons, buildMatchReasons
 */
export const FRENIX_MATCH_FUTURE_FACTORS = [
  "personality_compatibility",
  "communication_preferences",
  "nutrition_goals",
  "event_participation",
  "accountability_history",
  "ai_recommendations",
] as const;

export type FrennixMatchFutureFactor = (typeof FRENIX_MATCH_FUTURE_FACTORS)[number];

export type FrennixMatchLevelId = "exceptional" | "strong" | "good" | "potential";

export interface FrennixMatchLevel {
  id: FrennixMatchLevelId;
  min: number;
  max: number;
  emoji: string;
  label: string;
}

export const FRENIX_MATCH_LEVELS: readonly FrennixMatchLevel[] = [
  { id: "exceptional", min: 90, max: 100, emoji: "🟢", label: "Exceptional Frennix Match" },
  { id: "strong", min: 75, max: 89, emoji: "🔵", label: "Strong Frennix Match" },
  { id: "good", min: 60, max: 74, emoji: "🟠", label: "Good Frennix Match" },
  { id: "potential", min: 0, max: 59, emoji: "⚪", label: "Potential Frennix Match" },
] as const;

export function roundFrennixMatchScore(score: number): number {
  return Math.round(Math.max(0, Math.min(100, score)));
}

export function getFrennixMatchLevel(score: number): FrennixMatchLevel {
  const rounded = roundFrennixMatchScore(score);
  if (rounded >= 90) return FRENIX_MATCH_LEVELS[0]!;
  if (rounded >= 75) return FRENIX_MATCH_LEVELS[1]!;
  if (rounded >= 60) return FRENIX_MATCH_LEVELS[2]!;
  return FRENIX_MATCH_LEVELS[3]!;
}

export interface FrennixMatchDisplay {
  score: number;
  percentLabel: string;
  level: FrennixMatchLevel;
  levelLabel: string;
}

export function formatFrennixMatchDisplay(score: number): FrennixMatchDisplay | null {
  const rounded = roundFrennixMatchScore(score);
  if (rounded <= 0) return null;
  const level = getFrennixMatchLevel(rounded);
  return {
    score: rounded,
    percentLabel: `⭐ ${rounded}% ${FRENIX_MATCH_BRAND.name}`,
    level,
    levelLabel: `${level.emoji} ${level.label}`,
  };
}

export function getFrennixMatchWhyTitle(score: number): string {
  return score >= 60
    ? FRENIX_MATCH_BRAND.sections.whyGreat
    : FRENIX_MATCH_BRAND.sections.why;
}

export const FRENIX_MATCH_FILTER_THRESHOLDS = [
  { value: 90, label: "Exceptional (90%+)" },
  { value: 75, label: "Strong (75%+)" },
  { value: 60, label: "Good (60%+)" },
] as const;

/** @deprecated Use formatFrennixMatchDisplay — kept for gradual migration. */
export type CompatibilityBadge =
  | { kind: "percent"; label: string; score: number }
  | { kind: "phrase"; label: string; score: number }
  | null;

/** @deprecated Use formatFrennixMatchDisplay */
export function formatCompatibilityBadge(score: number): CompatibilityBadge {
  const display = formatFrennixMatchDisplay(score);
  if (!display) return null;
  return { kind: "percent", label: display.percentLabel, score: display.score };
}
