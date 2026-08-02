import type { MatchableProfile } from "@frennix/types";
import { formatActivity, formatGoal } from "@/lib/labels";
import { getDiscoverAvailability } from "@/lib/discover-profile-display";

const STRENGTH_ACTIVITIES = new Set([
  "weightlifting",
  "crossfit",
  "martial_arts",
]);

const RUNNING_ACTIVITIES = new Set(["running", "cycling", "hiking"]);

function isSeekingPartner(profile: MatchableProfile): boolean {
  return (
    profile.matching_enabled ||
    profile.fitness_goals?.includes("find_training_partner") ||
    profile.looking_for_parent_partner === true
  );
}

function primaryActivity(profile: MatchableProfile): string | null {
  const activity = profile.activities?.[0];
  return activity ?? null;
}

function primaryGoal(profile: MatchableProfile): string | null {
  const goal = profile.fitness_goals?.find((item) => item !== "find_training_partner");
  return goal ?? profile.fitness_goals?.[0] ?? null;
}

function hasMorningAvailability(profile: MatchableProfile): boolean {
  const times = profile.preferred_workout_times ?? [];
  return times.some((slot) => slot === "early_morning" || slot === "mid_morning");
}

/** One-line training intent for deck hero — omitted when profile data is too sparse. */
export function getTrainingPartnerPurposeLine(profile: MatchableProfile): string | null {
  const activity = primaryActivity(profile);
  const goal = primaryGoal(profile);
  const seeking = isSeekingPartner(profile);
  const availability = getDiscoverAvailability(profile);

  if (goal === "run_marathon") {
    return "🏃 Training for a marathon";
  }

  if (goal === "build_muscle") {
    return "💪 Wants to build muscle";
  }

  if (seeking && activity && STRENGTH_ACTIVITIES.has(activity)) {
    return "🟢 Looking for a lifting partner";
  }

  if (seeking && hasMorningAvailability(profile)) {
    return "🏋️ Morning workout partner";
  }

  if (seeking && activity && RUNNING_ACTIVITIES.has(activity)) {
    return `🏃 Looking for a ${formatActivity(activity).toLowerCase()} partner`;
  }

  if (seeking && goal === "find_training_partner") {
    return "🟢 Looking for a training partner";
  }

  if (seeking && activity) {
    return `🟢 Looking for a ${formatActivity(activity).toLowerCase()} partner`;
  }

  if (goal && goal !== "find_training_partner") {
    const label = formatGoal(goal);
    if (goal === "lose_weight") return "💪 Working toward weight loss";
    if (goal === "improve_endurance") return "🏃 Building endurance";
    if (goal === "stay_active") return "🟢 Staying active together";
    return `💪 ${label.charAt(0).toUpperCase()}${label.slice(1)}`;
  }

  if (activity && availability) {
    const timeBucket = availability.split(" · ")[0]?.toLowerCase();
    if (timeBucket) {
      return `🏋️ ${timeBucket} ${formatActivity(activity).toLowerCase()} sessions`;
    }
  }

  if (activity) {
    return `🏋️ ${formatActivity(activity)} training`;
  }

  return null;
}
