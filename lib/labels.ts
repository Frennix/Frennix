import { ACTIVITIES, FITNESS_GOALS, SPORTS, WORKOUT_INTERESTS } from "@frennix/types";

const goalLabels: Record<string, string> = {
  lose_weight: "Lose weight",
  build_muscle: "Build muscle",
  run_marathon: "Run a marathon",
  stay_active: "Stay active",
  improve_endurance: "Improve endurance",
  flexibility: "Flexibility",
  mental_wellness: "Mental wellness",
};

const activityLabels: Record<string, string> = {
  running: "Running",
  cycling: "Cycling",
  weightlifting: "Weightlifting",
  yoga: "Yoga",
  swimming: "Swimming",
  football: "Football",
  soccer: "Soccer",
  basketball: "Basketball",
  crossfit: "CrossFit",
  hiking: "Hiking",
  martial_arts: "Martial arts",
  other: "Other",
};

export function formatGoal(goal: string) {
  return goalLabels[goal] ?? goal;
}

export function formatActivity(activity: string) {
  return activityLabels[activity] ?? activity;
}

export { FITNESS_GOALS, SPORTS, WORKOUT_INTERESTS, ACTIVITIES };
