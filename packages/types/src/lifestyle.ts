/** Lifestyle Matching — optional profile fields for schedule and family context. */

export const PARENT_STATUSES = ["parent", "not_a_parent", "prefer_not_to_say"] as const;
export type ParentStatus = (typeof PARENT_STATUSES)[number];

export const PARENT_TYPES = ["mom", "dad", "guardian"] as const;
export type ParentType = (typeof PARENT_TYPES)[number];

export const CHILDREN_AGE_GROUPS = [
  "infant",
  "toddler",
  "elementary",
  "middle_school",
  "teen",
  "adult_children",
] as const;
export type ChildrenAgeGroup = (typeof CHILDREN_AGE_GROUPS)[number];

export const PREFERRED_WORKOUT_TIMES = [
  "early_morning",
  "mid_morning",
  "lunch",
  "afternoon",
  "evening",
  "after_kids_bedtime",
  "weekends",
] as const;
export type PreferredWorkoutTime = (typeof PREFERRED_WORKOUT_TIMES)[number];

/**
 * Extensible lifestyle catalog — add new tags here + DB array; no schema migration required.
 * UI for future tags ships independently of parent fields.
 */
export const LIFESTYLE_TAG_CATALOG = [
  "college_student",
  "busy_professional",
  "shift_worker",
  "military",
  "teacher",
  "healthcare_worker",
  "empty_nester",
  "retiree",
] as const;
export type LifestyleTagId = (typeof LIFESTYLE_TAG_CATALOG)[number];

/** Optional lifestyle fields stored on profiles (all nullable / empty by default). */
export interface LifestyleProfileFields {
  parent_status?: ParentStatus | null;
  parent_type?: ParentType | null;
  children_age_groups?: ChildrenAgeGroup[];
  preferred_workout_times?: PreferredWorkoutTime[];
  kid_friendly_workouts?: boolean | null;
  looking_for_parent_partner?: boolean | null;
  /** Future lifestyle categories (college_student, shift_worker, …). */
  lifestyle_tags?: LifestyleTagId[];
}

/** Discover compatibility filters — all optional. */
export interface DiscoverCompatibilityFilters {
  parentsOnly?: boolean;
  parentStatus?: ParentStatus;
  parentType?: ParentType;
  kidFriendlyWorkouts?: boolean;
  lookingForParentPartner?: boolean;
  childrenAgeGroup?: ChildrenAgeGroup;
  preferredWorkoutTime?: PreferredWorkoutTime;
  lifestyleTag?: LifestyleTagId;
  goal?: string;
  activity?: string;
  maxDistanceMiles?: number;
  minCompatibility?: number;
}

/** @deprecated Use DiscoverCompatibilityFilters */
export type LifestyleDiscoverFilters = DiscoverCompatibilityFilters;
