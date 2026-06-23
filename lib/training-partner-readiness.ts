import type { Profile } from "@frennix/types";

export type TrainingPartnerReadinessKey = "gender" | "goals" | "activities" | "city";

export type TrainingPartnerReadinessItem = {
  key: TrainingPartnerReadinessKey;
  label: string;
  description: string;
  complete: boolean;
};

export const TRAINING_PARTNER_READINESS_COPY: Record<
  TrainingPartnerReadinessKey,
  { label: string; description: string }
> = {
  gender: {
    label: "Gender selected",
    description: "Used for private training partner filters — never shown on your public profile.",
  },
  goals: {
    label: "At least one fitness goal",
    description: "Helps athletes find partners training toward similar outcomes.",
  },
  activities: {
    label: "At least one workout style",
    description: "Shows how you train so partners know if you are a good fit.",
  },
  city: {
    label: "City added",
    description: "Helps prioritize nearby athletes in your discovery deck.",
  },
};

export function getTrainingPartnerReadinessItems(
  profile: Profile
): TrainingPartnerReadinessItem[] {
  const checks: Record<TrainingPartnerReadinessKey, boolean> = {
    gender: Boolean(profile.gender),
    goals: (profile.fitness_goals ?? []).length > 0,
    activities: (profile.activities ?? []).length > 0,
    city: Boolean(profile.city?.trim()),
  };

  return (Object.keys(TRAINING_PARTNER_READINESS_COPY) as TrainingPartnerReadinessKey[]).map(
    (key) => ({
      key,
      ...TRAINING_PARTNER_READINESS_COPY[key],
      complete: checks[key],
    })
  );
}

export function isTrainingPartnerDiscoveryReady(profile: Profile): boolean {
  return getTrainingPartnerReadinessItems(profile).every((item) => item.complete);
}

export function getTrainingPartnerReadinessSummary(profile: Profile): string {
  const missing = getTrainingPartnerReadinessItems(profile)
    .filter((item) => !item.complete)
    .map((item) => item.label.toLowerCase());

  if (!missing.length) {
    return "Your profile is ready for training partner discovery.";
  }

  if (missing.length === 1) {
    return `Add ${missing[0]} before turning on discovery.`;
  }

  return `Complete ${missing.slice(0, -1).join(", ")} and ${missing[missing.length - 1]} before turning on discovery.`;
}
