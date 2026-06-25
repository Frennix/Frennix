import type { Profile } from "./index";

export const TRAINER_SPECIALTIES = [
  "weight_loss",
  "strength_training",
  "bodybuilding",
  "running",
  "sports_performance",
  "mobility",
  "nutrition",
  "other",
] as const;

export type TrainerSpecialty = (typeof TRAINER_SPECIALTIES)[number];

export const TRAINER_CATEGORIES = [
  "personal_trainer",
  "strength_coach",
  "running_coach",
  "nutrition_coach",
  "bodybuilding_coach",
  "weight_loss_coach",
  "sports_performance_coach",
  "mobility_flexibility_coach",
  "online_coach",
] as const;

export type TrainerCategory = (typeof TRAINER_CATEGORIES)[number];

export const TRAINER_AVAILABILITY_STATUSES = [
  "available",
  "limited",
  "not_accepting",
] as const;

export type TrainerAvailabilityStatus = (typeof TRAINER_AVAILABILITY_STATUSES)[number];

export const TRAINER_COACHING_FORMATS = ["online", "in_person", "hybrid"] as const;

export type TrainerCoachingFormat = (typeof TRAINER_COACHING_FORMATS)[number];

export const TRAINER_VERIFICATION_LEVELS = ["trainer", "verified", "featured"] as const;

export type TrainerVerificationLevel = (typeof TRAINER_VERIFICATION_LEVELS)[number];

export const TRAINER_CERTIFICATION_STATUSES = ["pending", "approved", "rejected"] as const;

export type TrainerCertificationStatus = (typeof TRAINER_CERTIFICATION_STATUSES)[number];

export const TRAINER_CONNECTION_STATUSES = [
  "pending",
  "connected",
  "declined",
  "removed",
] as const;

export type TrainerConnectionStatus = (typeof TRAINER_CONNECTION_STATUSES)[number];

export const TRAINER_PORTFOLIO_CATEGORIES = [
  "transformation",
  "client_result",
  "coaching",
] as const;

export type TrainerPortfolioCategory = (typeof TRAINER_PORTFOLIO_CATEGORIES)[number];

export interface TrainerProfile {
  user_id: string;
  bio: string | null;
  experience: string | null;
  training_philosophy: string | null;
  years_experience: number | null;
  specialties: TrainerSpecialty[];
  other_specialty: string | null;
  categories: TrainerCategory[];
  availability_status: TrainerAvailabilityStatus;
  coaching_formats: TrainerCoachingFormat[];
  verification_level: TrainerVerificationLevel;
  budget_min_monthly: number | null;
  budget_max_monthly: number | null;
  discovery_enabled: boolean;
  instagram_url: string | null;
  tiktok_url: string | null;
  youtube_url: string | null;
  website_url: string | null;
  linkedin_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrainerCertification {
  id: string;
  trainer_id: string;
  name: string;
  issuer: string | null;
  issued_year: number | null;
  document_url: string | null;
  document_path: string | null;
  review_status: TrainerCertificationStatus;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
}

export interface TrainerPortfolioPhoto {
  id: string;
  trainer_id: string;
  image_url: string;
  storage_path: string;
  caption: string | null;
  category: TrainerPortfolioCategory;
  sort_order: number;
  created_at: string;
}

export interface TrainerConnection {
  id: string;
  trainer_id: string;
  client_id: string;
  status: TrainerConnectionStatus;
  initiated_by: string;
  intro_message: string | null;
  created_at: string;
  updated_at: string;
  trainer?: Profile;
  client?: Profile;
}

export interface TrainerReviewStats {
  avg_rating: number | null;
  review_count: number;
}

export interface TrainerProfileBundle {
  profile: Profile;
  trainer: TrainerProfile;
  certifications: TrainerCertification[];
  portfolio: TrainerPortfolioPhoto[];
  connection?: TrainerConnection | null;
  review_stats?: TrainerReviewStats;
}

export interface TrainerSearchResult {
  profile: Profile;
  trainer: TrainerProfile;
  connection_status: TrainerConnectionStatus | null;
  approved_cert_count: number;
  portfolio_preview: TrainerPortfolioPhoto[];
}

export interface TrainerSearchFilters {
  query?: string;
  goal?: string;
  specialty?: TrainerSpecialty;
  category?: TrainerCategory;
  city?: string;
  budgetMax?: number;
  coachingFormat?: TrainerCoachingFormat;
  verificationLevel?: TrainerVerificationLevel;
  limit?: number;
  offset?: number;
}

export interface UpsertTrainerProfileInput {
  bio?: string | null;
  experience?: string | null;
  training_philosophy?: string | null;
  years_experience?: number | null;
  specialties?: TrainerSpecialty[];
  other_specialty?: string | null;
  categories?: TrainerCategory[];
  availability_status?: TrainerAvailabilityStatus;
  coaching_formats?: TrainerCoachingFormat[];
  budget_min_monthly?: number | null;
  budget_max_monthly?: number | null;
  discovery_enabled?: boolean;
  instagram_url?: string | null;
  tiktok_url?: string | null;
  youtube_url?: string | null;
  website_url?: string | null;
  linkedin_url?: string | null;
}

export interface AddTrainerCertificationInput {
  name: string;
  issuer?: string | null;
  issued_year?: number | null;
  document_url?: string | null;
  document_path?: string | null;
}

export interface AddTrainerPortfolioPhotoInput {
  image_url: string;
  storage_path: string;
  caption?: string | null;
  category?: TrainerPortfolioCategory;
  sort_order?: number;
}
