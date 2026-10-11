/** Story composer categories. Separate from posts.feed_category. */
export const STORY_COMPOSER_TABS = [
  { id: "workout", label: "Workout" },
  { id: "nutrition", label: "Nutrition" },
  { id: "general", label: "General" },
] as const;

export type StoryComposerCategory = (typeof STORY_COMPOSER_TABS)[number]["id"];

export const NUTRITION_MEAL_TEMPLATES = [
  { id: "meal-prep", label: "Meal Prep", caption: "Meal prep ready" },
  { id: "todays-meal", label: "Today’s Meal", caption: "Today’s meal" },
  { id: "post-workout-fuel", label: "Post-Workout Fuel", caption: "Post-workout fuel" },
  { id: "recipe-share", label: "Recipe Share", caption: "Recipe share" },
] as const;

export type NutritionMealTemplateId = (typeof NUTRITION_MEAL_TEMPLATES)[number]["id"];

export const MEAL_TAGS = ["Breakfast", "Lunch", "Dinner", "Snack"] as const;
export type MealTag = (typeof MEAL_TAGS)[number];

export const NUTRITION_STORY_POLLS = [
  { id: "sweet-or-savory", question: "Sweet or savory?", options: ["Sweet", "Savory"] },
  { id: "home-or-out", question: "Cook at home or eat out?", options: ["Cook at home", "Eat out"] },
] as const;

export function isStoryComposerCategory(value: unknown): value is StoryComposerCategory {
  return value === "workout" || value === "nutrition" || value === "general";
}

export function storyComposerFields(category: StoryComposerCategory) {
  return {
    showWorkoutTemplates: category === "workout",
    showMealTemplates: category === "nutrition",
    showMealTags: category === "nutrition",
    showWorkoutTags: category === "workout",
    showTrainingChallenge: category === "workout",
    showWorkoutCommitment: category === "workout",
    showQuestion: true,
    showPoll: true,
  };
}

export type StoryComposerSelection = {
  category: StoryComposerCategory;
  workoutTag: string | null;
  mealTemplateId: string | null;
  mealTag: string | null;
  trainingChallenge: string;
  workoutCommitment: string;
  question: string;
};

/** Visible fields for the active category. Hidden workout choices are not published. */
export function publishedStoryFields(selection: StoryComposerSelection) {
  const workout = selection.category === "workout";
  const nutrition = selection.category === "nutrition";
  const slideMeta: Record<string, unknown> = { story_category: selection.category };
  if (nutrition && selection.mealTemplateId) slideMeta.meal_template = selection.mealTemplateId;
  if (nutrition && selection.mealTag) slideMeta.meal_tag = selection.mealTag;

  return {
    workout_tag: workout ? selection.workoutTag : null,
    workout_type: workout ? selection.workoutTag : null,
    slide_meta: slideMeta,
    trainingChallenge: workout && selection.trainingChallenge.trim() ? selection.trainingChallenge.trim() : null,
    workoutCommitment: workout && selection.workoutCommitment.trim() ? selection.workoutCommitment.trim() : null,
    question: selection.question.trim() || null,
  };
}

export function readStoryComposerMeta(slides: Array<{ slide_meta?: Record<string, unknown> | null }>) {
  for (const slide of slides) {
    const meta = slide.slide_meta;
    if (!meta || !isStoryComposerCategory(meta.story_category)) continue;
    return {
      category: meta.story_category,
      mealTemplateId: typeof meta.meal_template === "string" ? meta.meal_template : null,
      mealTag: typeof meta.meal_tag === "string" ? meta.meal_tag : null,
    };
  }
  return null;
}

export function storyDisplayLabel(story: {
  workout_tag?: string | null;
  slides?: Array<{ slide_meta?: Record<string, unknown> | null }>;
}): string {
  const meta = readStoryComposerMeta(story.slides ?? []);
  if (meta?.category === "nutrition") {
    const template = NUTRITION_MEAL_TEMPLATES.find((item) => item.id === meta.mealTemplateId);
    return [template?.label ?? "Nutrition", meta.mealTag].filter(Boolean).join(" · ");
  }
  if (meta?.category === "general") return "Story";
  return story.workout_tag || "Story";
}

export function storyRingLabel(story: {
  workout_tag?: string | null;
  slides?: Array<{ slide_meta?: Record<string, unknown> | null }>;
}): string {
  const meta = readStoryComposerMeta(story.slides ?? []);
  if (meta?.category === "nutrition" || story.workout_tag) return storyDisplayLabel(story);
  const slideCount = story.slides?.length ?? 0;
  if (slideCount > 1) return `${slideCount} slides`;
  return "Story";
}
