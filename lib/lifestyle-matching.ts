import type {
  ChildrenAgeGroup,
  DiscoverCompatibilityFilters,
  LifestyleProfileFields,
  ParentStatus,
  ParentType,
  PreferredWorkoutTime,
  Profile,
} from "@frennix/types";
import {
  CHILDREN_AGE_GROUPS,
  FITNESS_GOALS,
  LIFESTYLE_TAG_CATALOG,
  PARENT_STATUSES,
  PARENT_TYPES,
  PREFERRED_WORKOUT_TIMES,
  WORKOUT_INTERESTS,
} from "@frennix/types";
import { distanceMilesBetween, FRENIX_MATCH_FILTER_THRESHOLDS } from "@frennix/matching";

/** Lifestyle profile + Discover filters — distinct from Frennix Match (the score engine). */
export const LIFESTYLE_BRAND = {
  profileSection: "Lifestyle",
  discoverFiltersTitle: "Lifestyle Filters",
  discoverFilteredHeading: "Lifestyle matches",
  discoverFilteredBody:
    "Athletes who match your optional Lifestyle Filters.",
  profileIntro:
    "Optional — parent status, workout schedule, and other preferences. Frennix uses this with your fitness profile to calculate your Frennix Match.",
  profileHintShort:
    "Optional details used with your fitness profile to calculate your Frennix Match.",
  filtersHint:
    "Optional — narrow results by lifestyle, goals, schedule, distance, or minimum Frennix Match.",
  emptyFilteredTitle: "No lifestyle matches",
  emptyFilteredDescription:
    "Try clearing a Lifestyle Filter or add Lifestyle details in Edit Profile.",
} as const;

export {
  CHILDREN_AGE_GROUPS,
  LIFESTYLE_TAG_CATALOG,
  PARENT_STATUSES,
  PARENT_TYPES,
  PREFERRED_WORKOUT_TIMES,
};

export function formatParentStatus(value: ParentStatus): string {
  const labels: Record<ParentStatus, string> = {
    parent: "Parent",
    not_a_parent: "Not a Parent",
    prefer_not_to_say: "Prefer Not to Say",
  };
  return labels[value];
}

export function formatParentType(value: ParentType): string {
  const labels: Record<ParentType, string> = {
    mom: "Mom",
    dad: "Dad",
    guardian: "Guardian",
  };
  return labels[value];
}

export function formatChildrenAgeGroup(value: ChildrenAgeGroup): string {
  const labels: Record<ChildrenAgeGroup, string> = {
    infant: "Infant (0–2)",
    toddler: "Toddler (3–5)",
    elementary: "Elementary",
    middle_school: "Middle School",
    teen: "Teen",
    adult_children: "Adult Children",
  };
  return labels[value];
}

export function formatPreferredWorkoutTime(value: PreferredWorkoutTime): string {
  const labels: Record<PreferredWorkoutTime, string> = {
    early_morning: "Early Morning",
    mid_morning: "Mid Morning",
    lunch: "Lunch",
    afternoon: "Afternoon",
    evening: "Evening",
    after_kids_bedtime: "After Kids' Bedtime",
    weekends: "Weekends",
  };
  return labels[value];
}

export function formatLifestyleTag(tag: string): string {
  return tag.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Short badge labels for profile and discover cards. */
export function getLifestyleBadges(profile: LifestyleProfileFields & Pick<Profile, "fitness_goals">): string[] {
  const badges: string[] = [];
  const seen = new Set<string>();

  function add(label: string) {
    if (!seen.has(label)) {
      seen.add(label);
      badges.push(label);
    }
  }

  if (profile.parent_type === "mom") add("Mom");
  else if (profile.parent_type === "dad") add("Dad");
  else if (profile.parent_type === "guardian") add("Guardian");

  const ageGroups = profile.children_age_groups ?? [];
  if (ageGroups.includes("toddler")) add("Toddler Parent");
  else if (ageGroups.includes("infant")) add("Infant Parent");

  if (profile.kid_friendly_workouts === true) add("Kid-Friendly");

  const times = profile.preferred_workout_times ?? [];
  if (times.includes("early_morning") || times.includes("mid_morning")) {
    add("Morning Workouts");
  }
  if (times.includes("weekends")) add("Weekend Warrior");

  if (profile.looking_for_parent_partner === true) add("Parent Partner");

  if ((profile.fitness_goals ?? []).includes("accountability_partner")) {
    add("Accountability Partner");
  }

  for (const tag of profile.lifestyle_tags ?? []) {
    add(formatLifestyleTag(tag));
  }

  return badges.slice(0, 6);
}

export function hasLifestyleData(fields: LifestyleProfileFields): boolean {
  return (
    fields.parent_status != null ||
    fields.parent_type != null ||
    (fields.children_age_groups?.length ?? 0) > 0 ||
    (fields.preferred_workout_times?.length ?? 0) > 0 ||
    fields.kid_friendly_workouts != null ||
    fields.looking_for_parent_partner != null ||
    (fields.lifestyle_tags?.length ?? 0) > 0
  );
}

export function hasActiveDiscoverFilters(filters: DiscoverCompatibilityFilters): boolean {
  return (
    filters.parentsOnly === true ||
    filters.parentStatus != null ||
    filters.parentType != null ||
    filters.kidFriendlyWorkouts === true ||
    filters.lookingForParentPartner === true ||
    filters.childrenAgeGroup != null ||
    filters.preferredWorkoutTime != null ||
    filters.lifestyleTag != null ||
    filters.goal != null ||
    filters.activity != null ||
    filters.maxDistanceMiles != null ||
    filters.minCompatibility != null
  );
}

/** @deprecated */
export const hasActiveLifestyleFilters = hasActiveDiscoverFilters;

export function matchesDiscoverFilters(
  profile: Profile,
  filters: DiscoverCompatibilityFilters,
  viewer?: Profile,
  compatibilityScore?: number
): boolean {
  if (filters.parentsOnly && profile.parent_status !== "parent") return false;
  if (filters.parentStatus && profile.parent_status !== filters.parentStatus) return false;
  if (filters.parentType && profile.parent_type !== filters.parentType) return false;
  if (filters.kidFriendlyWorkouts && profile.kid_friendly_workouts !== true) return false;
  if (filters.lookingForParentPartner && profile.looking_for_parent_partner !== true) {
    return false;
  }
  if (
    filters.childrenAgeGroup &&
    !(profile.children_age_groups ?? []).includes(filters.childrenAgeGroup)
  ) {
    return false;
  }
  if (
    filters.preferredWorkoutTime &&
    !(profile.preferred_workout_times ?? []).includes(filters.preferredWorkoutTime)
  ) {
    return false;
  }
  if (
    filters.lifestyleTag &&
    !(profile.lifestyle_tags ?? []).includes(filters.lifestyleTag)
  ) {
    return false;
  }
  if (filters.goal && !(profile.fitness_goals ?? []).includes(filters.goal)) return false;
  if (filters.activity && !(profile.activities ?? []).includes(filters.activity)) return false;

  if (filters.maxDistanceMiles != null && viewer) {
    const miles = distanceMilesBetween(viewer, profile);
    if (miles == null || miles > filters.maxDistanceMiles) return false;
  }

  if (
    filters.minCompatibility != null &&
    compatibilityScore != null &&
    compatibilityScore < filters.minCompatibility
  ) {
    return false;
  }

  return true;
}

/** @deprecated */
export const matchesLifestyleFilters = (
  profile: LifestyleProfileFields,
  filters: DiscoverCompatibilityFilters
) => matchesDiscoverFilters(profile as Profile, filters);

export function buildLifestyleProfilePatch(
  fields: LifestyleProfileFields
): Partial<Profile> {
  const isParent = fields.parent_status === "parent";
  return {
    parent_status: fields.parent_status ?? null,
    parent_type: isParent ? fields.parent_type ?? null : null,
    children_age_groups: isParent ? fields.children_age_groups ?? [] : [],
    preferred_workout_times: fields.preferred_workout_times ?? [],
    kid_friendly_workouts: fields.kid_friendly_workouts ?? null,
    looking_for_parent_partner: fields.looking_for_parent_partner ?? null,
    lifestyle_tags: fields.lifestyle_tags ?? [],
  };
}

export function lifestyleFieldsFromProfile(profile: Profile | null | undefined): LifestyleProfileFields {
  if (!profile) {
    return EMPTY_LIFESTYLE_FIELDS;
  }
  return {
    parent_status: profile.parent_status ?? null,
    parent_type: profile.parent_type ?? null,
    children_age_groups: profile.children_age_groups ?? [],
    preferred_workout_times: profile.preferred_workout_times ?? [],
    kid_friendly_workouts: profile.kid_friendly_workouts ?? null,
    looking_for_parent_partner: profile.looking_for_parent_partner ?? null,
    lifestyle_tags: profile.lifestyle_tags ?? [],
  };
}

export const EMPTY_LIFESTYLE_FIELDS: LifestyleProfileFields = {
  parent_status: null,
  parent_type: null,
  children_age_groups: [],
  preferred_workout_times: [],
  kid_friendly_workouts: null,
  looking_for_parent_partner: null,
  lifestyle_tags: [],
};

export const DISCOVER_GOAL_FILTERS = FITNESS_GOALS;
export const DISCOVER_ACTIVITY_FILTERS = WORKOUT_INTERESTS;

export const COMPATIBILITY_FILTER_THRESHOLDS = FRENIX_MATCH_FILTER_THRESHOLDS;

/** @deprecated Use FRENIX_MATCH_FILTER_THRESHOLDS from @frennix/matching */
export { FRENIX_MATCH_FILTER_THRESHOLDS };

export const DISTANCE_FILTER_OPTIONS = [
  { value: 5, label: "Within 5 mi" },
  { value: 15, label: "Within 15 mi" },
  { value: 30, label: "Within 30 mi" },
] as const;
