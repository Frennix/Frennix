import type { MatchPreference } from "@frennix/types";

export const TRAINING_PARTNER_GENDERS = [
  "female",
  "male",
  "non_binary",
  "prefer_not_to_say",
] as const;

export type TrainingPartnerGender = (typeof TRAINING_PARTNER_GENDERS)[number];

export const TRAINING_PARTNER_PREFS: { value: MatchPreference; label: string; description: string }[] = [
  { value: "any", label: "Any athlete", description: "See all athletes who match your other filters." },
  { value: "same", label: "Same gender", description: "Only show athletes with the same gender as you." },
  {
    value: "opposite",
    label: "Different gender",
    description: "Only show athletes with a different gender than you.",
  },
];

export function formatTrainingPartnerGender(gender: string) {
  return gender.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
