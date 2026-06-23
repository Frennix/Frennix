import type { TrainerProfile } from "@frennix/types";

export function formatTrainerBudgetRange(trainer: Pick<TrainerProfile, "budget_min_monthly" | "budget_max_monthly">): string | null {
  const { budget_min_monthly: min, budget_max_monthly: max } = trainer;
  if (min == null && max == null) return null;

  const fmt = (cents: number) => `$${Math.round(cents / 100)}`;

  if (min != null && max != null) return `${fmt(min)}–${fmt(max)}/mo`;
  if (min != null) return `From ${fmt(min)}/mo`;
  return `Up to ${fmt(max!)}/mo`;
}

export function formatYearsExperience(years: number | null | undefined): string | null {
  if (years == null || years <= 0) return null;
  return years === 1 ? "1 year experience" : `${years} years experience`;
}

export function normalizeSocialUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function displaySocialHandle(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
