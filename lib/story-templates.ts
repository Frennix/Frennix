/** Fitness-first one-tap story caption templates. */
export const STORY_WORKOUT_TEMPLATES = [
  { id: "just-finished", label: "Just Finished Workout", caption: "Just finished my workout 💪" },
  { id: "need-partner", label: "Need a Training Partner", caption: "Need a training partner — who's in? 🤝" },
  { id: "running-today", label: "Who's Running Today?", caption: "Who's running today? 🏃" },
  { id: "gym-checkin", label: "Gym Check-In", caption: "Gym check-in ✅" },
  { id: "pr", label: "PR (Personal Record)", caption: "New personal record 🎉" },
  { id: "recovery", label: "Recovery Day", caption: "Recovery day — listening to my body 🧘" },
] as const;

export type StoryWorkoutTemplateId = (typeof STORY_WORKOUT_TEMPLATES)[number]["id"];
