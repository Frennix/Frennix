import type {
  TrainerAvailabilityStatus,
  TrainerCategory,
  TrainerCoachingFormat,
  TrainerPortfolioCategory,
  TrainerSpecialty,
  TrainerVerificationLevel,
} from "@frennix/types";

export function formatTrainerSpecialty(specialty: TrainerSpecialty): string {
  const labels: Record<TrainerSpecialty, string> = {
    weight_loss: "Weight loss",
    strength_training: "Strength training",
    bodybuilding: "Bodybuilding",
    running: "Running",
    sports_performance: "Sports performance",
    mobility: "Mobility",
    nutrition: "Nutrition",
    other: "Other",
  };
  return labels[specialty] ?? specialty;
}

export function formatTrainerCategory(category: TrainerCategory): string {
  const labels: Record<TrainerCategory, string> = {
    personal_trainer: "Personal Trainer",
    strength_coach: "Strength Coach",
    running_coach: "Running Coach",
    nutrition_coach: "Nutrition Coach",
    bodybuilding_coach: "Bodybuilding Coach",
    weight_loss_coach: "Weight Loss Coach",
    sports_performance_coach: "Sports Performance Coach",
    mobility_flexibility_coach: "Mobility/Flexibility Coach",
    online_coach: "Online Coach",
  };
  return labels[category] ?? category;
}

export function formatTrainerAvailability(status: TrainerAvailabilityStatus): string {
  const labels: Record<TrainerAvailabilityStatus, string> = {
    available: "Available for new clients",
    limited: "Limited availability",
    not_accepting: "Not accepting clients",
  };
  return labels[status] ?? status;
}

export function formatCoachingFormat(format: TrainerCoachingFormat): string {
  const labels: Record<TrainerCoachingFormat, string> = {
    online: "Online coaching",
    in_person: "In-person coaching",
    hybrid: "Hybrid coaching",
  };
  return labels[format] ?? format;
}

export function formatVerificationLevel(level: TrainerVerificationLevel): string {
  const labels: Record<TrainerVerificationLevel, string> = {
    trainer: "Trainer",
    verified: "Verified Trainer",
    featured: "Featured Trainer",
  };
  return labels[level] ?? level;
}

export function formatPortfolioCategory(category: TrainerPortfolioCategory): string {
  const labels: Record<TrainerPortfolioCategory, string> = {
    transformation: "Transformation",
    client_result: "Client result",
    coaching: "Coaching",
  };
  return labels[category] ?? category;
}

export const TRAINER_GOAL_FILTER_OPTIONS = [
  { value: "weight_loss", label: "Weight loss" },
  { value: "strength_training", label: "Strength training" },
  { value: "bodybuilding", label: "Bodybuilding" },
  { value: "running", label: "Running" },
  { value: "sports_performance", label: "Sports performance" },
  { value: "mobility", label: "Mobility" },
  { value: "nutrition", label: "Nutrition" },
] as const;

export const TRAINER_BUDGET_FILTER_OPTIONS = [
  { value: 5000, label: "Up to $50/mo" },
  { value: 10000, label: "Up to $100/mo" },
  { value: 20000, label: "Up to $200/mo" },
  { value: 50000, label: "Up to $500/mo" },
] as const;
