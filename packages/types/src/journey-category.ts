/** Optional journey categories for Frennix Reels. Stored as slugs on posts. */
export const JOURNEY_CATEGORIES = [
  "starting_over",
  "mental_wellness",
  "weight_loss",
  "strength",
  "recovery",
  "confidence",
  "parenthood",
  "sobriety",
  "consistency",
] as const;

export type JourneyCategory = (typeof JOURNEY_CATEGORIES)[number];

export const JOURNEY_CATEGORY_LABELS: Record<JourneyCategory, string> = {
  starting_over: "Starting Over",
  mental_wellness: "Mental Wellness",
  weight_loss: "Weight Loss",
  strength: "Strength",
  recovery: "Recovery",
  confidence: "Confidence",
  parenthood: "Parenthood",
  sobriety: "Sobriety",
  consistency: "Consistency",
};

export function parseJourneyCategory(value: string | null | undefined): JourneyCategory | null {
  if (!value) return null;
  return (JOURNEY_CATEGORIES as readonly string[]).includes(value)
    ? (value as JourneyCategory)
    : null;
}

export function getJourneyCategoryLabel(value: string | null | undefined): string | null {
  const category = parseJourneyCategory(value);
  return category ? JOURNEY_CATEGORY_LABELS[category] : null;
}
