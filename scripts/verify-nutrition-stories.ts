/**
 * Nutrition stories stay separate from the Home feed category filter.
 * Category and meal details are stored on slide_meta, which already exists.
 *
 * Usage: npx tsx scripts/verify-nutrition-stories.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  NUTRITION_MEAL_TEMPLATES,
  publishedStoryFields,
  readStoryComposerMeta,
  storyComposerFields,
  storyDisplayLabel,
  storyRingLabel,
} from "../packages/types/src/story-composer";
import {
  consumeStoryFreshStart,
  markStoryPublished,
  storyNeedsFreshStart,
} from "../lib/story-composer-session";

const ROOT = join(import.meta.dirname, "..");

function read(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const filled = {
  workoutTag: "Running",
  mealTemplateId: "meal-prep",
  mealTag: "Breakfast",
  trainingChallenge: "100 push-ups today",
  workoutCommitment: "5K run before sunset",
  question: "What should I make next?",
};

const nutrition = publishedStoryFields({ category: "nutrition", ...filled });
assert(nutrition.workout_tag === null, "nutrition must not publish a workout tag");
assert(nutrition.workout_type === null, "nutrition must not publish a workout type");
assert(nutrition.trainingChallenge === null, "nutrition must not publish a training challenge");
assert(nutrition.workoutCommitment === null, "nutrition must not publish a workout commitment");
assert(nutrition.question === filled.question, "nutrition keeps an optional question");
assert(nutrition.slide_meta.story_category === "nutrition", "nutrition category is stored explicitly");
assert(nutrition.slide_meta.meal_template === "meal-prep", "meal template is stored");
assert(nutrition.slide_meta.meal_tag === "Breakfast", "meal tag is stored");

const workout = publishedStoryFields({ category: "workout", ...filled, mealTag: null, mealTemplateId: null });
assert(workout.workout_tag === "Running", "workout stories still publish their tag");
assert(workout.workout_type === "Running", "workout stories still publish their type");
assert(workout.trainingChallenge === filled.trainingChallenge, "workout stories still publish challenges");
assert(workout.workoutCommitment === filled.workoutCommitment, "workout stories still publish commitments");
assert(workout.slide_meta.story_category === "workout", "workout category is stored explicitly");
assert(workout.slide_meta.meal_template == null, "workout stories do not store a meal template");

const general = publishedStoryFields({ category: "general", ...filled });
assert(general.workout_tag === null, "general must not publish a workout tag");
assert(general.trainingChallenge === null, "general must not publish a training challenge");
assert(general.workoutCommitment === null, "general must not publish a workout commitment");
assert(general.question === filled.question, "general keeps an optional question");
assert(general.slide_meta.story_category === "general", "general category is stored explicitly");
assert(general.slide_meta.meal_tag == null, "general does not store a meal tag");

const nutritionFields = storyComposerFields("nutrition");
assert(nutritionFields.showMealTemplates && nutritionFields.showMealTags, "nutrition shows meal choices");
assert(!nutritionFields.showWorkoutTags && !nutritionFields.showTrainingChallenge, "nutrition hides workout extras");
assert(nutritionFields.showQuestion && nutritionFields.showPoll, "nutrition keeps questions and polls");
assert(storyComposerFields("workout").showWorkoutTags, "workout keeps workout tags");
assert(!storyComposerFields("general").showMealTemplates, "general does not show meal templates");

const savedNutrition = storyDisplayLabel({
  workout_tag: "Running",
  slides: [{ slide_meta: nutrition.slide_meta }],
});
assert(savedNutrition === "Meal Prep · Breakfast", `nutrition viewer label was ${savedNutrition}`);
assert(
  storyRingLabel({ workout_tag: null, slides: [{ slide_meta: nutrition.slide_meta }] }) === "Meal Prep · Breakfast",
  "story ring uses the saved meal label"
);

const captionOnly = storyDisplayLabel({
  workout_tag: null,
  slides: [{ slide_meta: {}, caption: "Meal prep ready" } as { slide_meta: Record<string, unknown> }],
});
assert(captionOnly === "Story", "a meal caption does not imply a nutrition story");
assert(readStoryComposerMeta([{ slide_meta: {} }]) === null, "missing category stays unset");
assert(
  storyDisplayLabel({ workout_tag: "Running", slides: [{ slide_meta: {} }] }) === "Running",
  "existing workout stories still show their tag"
);

consumeStoryFreshStart();
assert(!storyNeedsFreshStart(), "a failed publish leaves the next open on the current draft");
markStoryPublished();
assert(storyNeedsFreshStart(), "a successful publish marks the next story empty");
assert(consumeStoryFreshStart(), "the next open consumes the fresh start");
assert(!consumeStoryFreshStart(), "a later open does not clear a new draft");

const composer = read("app/create-story.tsx");
assert(
  composer.includes('import { useIsFocused } from "@react-navigation/native"'),
  "focus comes from React Navigation, which exports useIsFocused"
);
assert(
  !composer.includes("useIsFocused } from \"expo-router\"") && !composer.includes("useIsFocused } from 'expo-router'"),
  "expo-router does not export useIsFocused"
);
const expoRouterExports = read("node_modules/expo-router/build/exports.js");
assert(!expoRouterExports.includes('exports.useIsFocused'), "expo-router 4 does not export useIsFocused");
assert(expoRouterExports.includes('exports.useFocusEffect'), "expo-router still exports useFocusEffect");
const navigationCore = read("node_modules/@react-navigation/core/lib/module/index.js");
const navigationNative = read("node_modules/@react-navigation/native/lib/module/index.js");
assert(navigationCore.includes('export { useIsFocused }'), "@react-navigation/core exports useIsFocused");
assert(navigationNative.includes("export * from '@react-navigation/core'"), "@react-navigation/native re-exports core, including useIsFocused");
assert(composer.includes("onChange={setCategory}"), "category changes through the tab control");
assert(!composer.includes("feed_category"), "story categories stay off the home feed column");
assert(composer.includes("slide_meta: fields.slide_meta"), "publish writes slide metadata");
assert(composer.includes("markStoryPublished()"), "success marks the next story empty");
const failure = composer.slice(composer.indexOf("catch (publishError)"), composer.indexOf("finally"));
assert(!failure.includes("markStoryPublished"), "a failed publish does not clear the draft");
assert(composer.includes("Share workouts, meals"), "the introduction mentions meals");
assert(composer.includes('maxLength={CAPTION_MAX}') && composer.includes("const CAPTION_MAX = 280"), "caption limit stays 280");
assert(composer.includes("const MAX_SLIDES = 10"), "slide limit stays 10");
assert(composer.includes("automaticallyAdjustKeyboardInsets"), "the form follows the keyboard");
assert(composer.includes('resizeMode="contain"'), "photo preview keeps the full image");
assert(composer.includes("resizeMode={ResizeMode.CONTAIN}"), "video preview keeps the full frame");
const templates = read("packages/types/src/story-composer.ts");
for (const template of NUTRITION_MEAL_TEMPLATES) {
  assert(templates.includes(template.label), `meal templates include ${template.label}`);
}
for (const tag of ["Breakfast", "Lunch", "Dinner", "Snack"]) {
  assert(templates.includes(tag), `meal tags include ${tag}`);
}
assert(composer.includes("NUTRITION_MEAL_TEMPLATES.map"), "composer renders meal templates");
assert(composer.includes("MEAL_TAGS.map"), "composer renders meal tags");
assert(composer.includes("STORY_WORKOUT_TAGS"), "workout tags remain available");
assert(composer.includes("Training challenge (optional)"), "workout challenges remain available");
assert(composer.includes("Workout commitment (optional)"), "workout commitments remain available");
assert(composer.includes('placeholder="Add a caption"') || composer.includes('? "Add a caption"'), "general uses a neutral caption");
assert(read("packages/api/src/story-publish.ts").includes("STORY_TTL_MS = 24 * 60 * 60 * 1000"), "stories still expire after 24 hours");
assert(read("packages/api/src/posts.ts").includes("feed_category"), "home feed filtering is unchanged");
assert(!read("packages/api/src/stories.ts").includes("feed_category"), "story loading does not use the home feed column");

console.log("nutrition story checks passed");
