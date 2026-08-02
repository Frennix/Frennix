import type { PreferredWorkoutTime, Profile } from "@frennix/types";
import { isPresenceVisible, isProfileOnline } from "@frennix/ui";
import { formatActivity, formatGoal } from "@/lib/labels";
import { formatPreferredWorkoutTime } from "@/lib/lifestyle-matching";
import { formatPublicLocationLabel } from "@/lib/location-discovery-ui";

const MORNING_TIMES = new Set<PreferredWorkoutTime>(["early_morning", "mid_morning"]);
const AFTERNOON_TIMES = new Set<PreferredWorkoutTime>(["lunch", "afternoon"]);
const EVENING_TIMES = new Set<PreferredWorkoutTime>(["evening", "after_kids_bedtime"]);

export function getDiscoverFirstName(profile: Profile): string {
  const trimmed = profile.display_name?.trim();
  if (!trimmed) return profile.username;
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

export function getDiscoverDistanceLabel(profile: Profile): string | null {
  if (profile.distance_bucket_label?.trim()) {
    return profile.distance_bucket_label.trim();
  }
  return formatPublicLocationLabel(profile);
}

export function getDiscoverCompactDistanceLabel(profile: Profile): string | null {
  const label = getDiscoverDistanceLabel(profile);
  if (!label) return null;

  return label
    .replace(/ miles away/g, " mi")
    .replace(/Less than 5 mi/g, "<5 mi")
    .replace(/ away/g, "");
}

export function getDiscoverWorkoutStyle(profile: Profile): string | null {
  const activity = profile.activities?.[0];
  return activity ? formatActivity(activity) : null;
}

export function getDiscoverFitnessGoal(profile: Profile): string | null {
  const goal = profile.fitness_goals?.[0];
  return goal ? formatGoal(goal) : null;
}

export function getDiscoverAvailability(profile: Profile): string | null {
  const times = profile.preferred_workout_times ?? [];
  if (!times.length) return null;

  const buckets: string[] = [];
  if (times.some((slot) => MORNING_TIMES.has(slot))) buckets.push("Morning");
  if (times.some((slot) => AFTERNOON_TIMES.has(slot))) buckets.push("Afternoon");
  if (times.some((slot) => EVENING_TIMES.has(slot))) buckets.push("Evening");
  if (times.includes("weekends") && buckets.length < 2) buckets.push("Weekends");

  if (buckets.length) return buckets.slice(0, 2).join(" · ");

  return formatPreferredWorkoutTime(times[0]);
}

export function getDiscoverPartnerStatusBadge(profile: Profile): string {
  const seekingPartner =
    profile.matching_enabled ||
    profile.fitness_goals?.includes("find_training_partner") ||
    profile.looking_for_parent_partner;

  return seekingPartner ? "Looking for a Partner" : "Available to Train";
}

export type DiscoverPartnerStatusTone = "partner" | "available" | "training" | "trainer";

export type DiscoverPartnerStatusInfo = {
  label: string;
  tone: DiscoverPartnerStatusTone;
};

export function getDiscoverPartnerStatusInfo(profile: Profile): DiscoverPartnerStatusInfo {
  if (profile.is_trainer) {
    return { label: "Trainer Available", tone: "trainer" };
  }

  const seekingPartner =
    profile.matching_enabled ||
    profile.fitness_goals?.includes("find_training_partner") ||
    profile.looking_for_parent_partner;

  if (seekingPartner) {
    return { label: "Seeking Partner", tone: "partner" };
  }

  return { label: "Open to Train", tone: "available" };
}

/** @deprecated Use getDiscoverPartnerStatusInfo */
export function getDiscoverPartnerStatusShortLabel(profile: Profile): string {
  return getDiscoverPartnerStatusInfo(profile).label;
}

export function viewerHasDiscoverLocationEnabled(viewer: Profile | null | undefined): boolean {
  if (!viewer) return false;
  if (viewer.use_location_for_matching === false) return false;
  return viewer.latitude != null && viewer.longitude != null;
}

export function profileHasDiscoverDistanceData(profile: Profile): boolean {
  return !!profile.distance_bucket_label?.trim();
}

export function peopleHaveDiscoverDistanceData(people: { profile: Profile }[]): boolean {
  return people.some((item) => profileHasDiscoverDistanceData(item.profile));
}

export function getDiscoverPeopleSectionTitle(options: {
  lifestyleFiltersActive: boolean;
  lifestyleFilteredHeading: string;
  viewer: Profile | null | undefined;
  people: { profile: Profile }[];
}): string {
  if (options.lifestyleFiltersActive) return options.lifestyleFilteredHeading;
  if (
    viewerHasDiscoverLocationEnabled(options.viewer) &&
    peopleHaveDiscoverDistanceData(options.people)
  ) {
    return "Training Partners Near You";
  }
  return "Suggested Training Partners";
}

export function getDiscoverRecentActivityLabel(
  profile: Profile,
  now = new Date()
): string | null {
  if (!isPresenceVisible(profile)) return null;
  if (isProfileOnline(profile, now)) return "Active now";

  if (!profile.last_seen_at) return null;
  const seen = new Date(profile.last_seen_at);
  if (Number.isNaN(seen.getTime())) return null;

  const sameDay =
    seen.getFullYear() === now.getFullYear() &&
    seen.getMonth() === now.getMonth() &&
    seen.getDate() === now.getDate();

  return sameDay ? "Active today" : null;
}

export function getDiscoverStreakLabel(streak: number | null | undefined): string | null {
  if (!streak || streak <= 0) return null;
  return `🔥 ${streak} Day${streak === 1 ? "" : "s"} Streak`;
}

export function getDiscoverCompactStreakLabel(streak: number | null | undefined): string | null {
  if (!streak || streak <= 0) return null;
  return `🔥 ${streak}d streak`;
}
