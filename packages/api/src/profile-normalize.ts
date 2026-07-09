import type { Profile } from "@frennix/types";
import { coerceStringArray } from "@frennix/matching";

function sanitizeAvatarUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

/** Coerce legacy/partial profile rows and cached shapes into a safe Profile. */
export function normalizeProfile(raw: Profile | null | undefined): Profile | null {
  if (!raw || typeof raw !== "object") return null;

  const username =
    typeof raw.username === "string" ? raw.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "") : "";
  const displayName =
    typeof raw.display_name === "string" && raw.display_name.trim()
      ? raw.display_name.trim()
      : username || "Athlete";

  return {
    ...raw,
    username,
    display_name: displayName,
    avatar_url: sanitizeAvatarUrl(raw.avatar_url),
    bio: typeof raw.bio === "string" ? raw.bio : null,
    city: typeof raw.city === "string" && raw.city.trim() ? raw.city.trim() : null,
    fitness_goals: coerceStringArray(raw.fitness_goals),
    activities: coerceStringArray(raw.activities),
    children_age_groups: coerceStringArray(raw.children_age_groups),
    preferred_workout_times: coerceStringArray(raw.preferred_workout_times),
    lifestyle_tags: coerceStringArray(raw.lifestyle_tags),
    training_schedules: Array.isArray(raw.training_schedules) ? raw.training_schedules : [],
    onboarding_complete: raw.onboarding_complete === true,
    visibility:
      raw.visibility === "followers" || raw.visibility === "private" ? raw.visibility : "public",
    matching_enabled: raw.matching_enabled !== false,
    is_premium: Boolean(raw.is_premium),
    gender: typeof raw.gender === "string" ? raw.gender : null,
    match_preference:
      raw.match_preference === "same" ||
      raw.match_preference === "opposite" ||
      raw.match_preference === "any"
        ? raw.match_preference
        : "any",
  };
}

/** True when account data is too incomplete to open the main app safely. */
export function profileNeedsOnboardingRepair(profile: Profile | null | undefined): boolean {
  const normalized = normalizeProfile(profile);
  if (!normalized) return true;
  if (!normalized.onboarding_complete) return true;
  if (!normalized.username || normalized.username.length < 3) return true;
  if (!normalized.display_name?.trim()) return true;
  if (coerceStringArray(normalized.fitness_goals).length === 0) return true;
  if (coerceStringArray(normalized.activities).length === 0) return true;
  return false;
}

export function describeProfileRepairReason(profile: Profile | null | undefined): string | null {
  const normalized = normalizeProfile(profile);
  if (!normalized) return "missing profile row";
  if (!normalized.onboarding_complete) return "onboarding_complete is false";
  if (!normalized.username || normalized.username.length < 3) return "username missing or invalid";
  if (!normalized.display_name?.trim()) return "display_name missing";
  if (coerceStringArray(normalized.fitness_goals).length === 0) return "fitness_goals empty";
  if (coerceStringArray(normalized.activities).length === 0) return "activities empty";
  return null;
}
