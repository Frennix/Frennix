/** Display labels for match reason copy — keep in sync with app/lib/labels.ts where overlapping. */

const goalLabels: Record<string, string> = {
  lose_weight: "lose weight",
  build_muscle: "build muscle",
  run_marathon: "run a marathon",
  stay_active: "stay active",
  improve_endurance: "improve endurance",
  flexibility: "flexibility",
  mental_wellness: "mental wellness",
  accountability_partner: "an accountability partner",
  find_training_partner: "a training partner",
};

const activityLabels: Record<string, string> = {
  running: "running",
  cycling: "cycling",
  weightlifting: "lifting",
  yoga: "yoga",
  swimming: "swimming",
  football: "football",
  soccer: "soccer",
  basketball: "basketball",
  crossfit: "CrossFit",
  hiking: "hiking",
  martial_arts: "martial arts",
  other: "training",
};

const scheduleLabels: Record<string, string> = {
  morning: "mornings",
  afternoon: "afternoons",
  evening: "evenings",
  weekend: "weekends",
};

const environmentLabels: Record<string, string> = {
  indoor: "indoor training",
  outdoor: "outdoor training",
  both: "indoor and outdoor training",
};

const skillLabels: Record<string, string> = {
  beginner: "beginner",
  intermediate: "intermediate",
  advanced: "advanced",
};

export function formatMatchGoal(goal: string): string {
  return goalLabels[goal] ?? goal.replace(/_/g, " ");
}

export function formatMatchActivity(activity: string): string {
  return activityLabels[activity] ?? activity.replace(/_/g, " ");
}

export function formatMatchSchedule(slot: string): string {
  return scheduleLabels[slot] ?? slot;
}

export function formatMatchEnvironment(env: string): string {
  return environmentLabels[env] ?? env;
}

export function formatMatchSkill(level: string): string {
  return skillLabels[level] ?? level;
}

export function joinNaturalList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}
