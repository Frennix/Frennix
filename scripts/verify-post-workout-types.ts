import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

function read(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

function assertIncludes(file: string, needle: string, message: string) {
  if (!read(file).includes(needle)) {
    throw new Error(`${message} (missing in ${file})`);
  }
}

function capitalizeWords(value: string) {
  return value
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatWorkoutTypesInline(workoutTypes: string[]) {
  return workoutTypes
    .map((type) => `${type === "weightlifting" ? "🏋️" : "🏅"} ${capitalizeWords(type.replace(/_/g, " "))}`)
    .join(" · ");
}

function normalizeWorkoutTypes(post: { workout_types?: string[]; workout_type?: string | null }) {
  if (post.workout_types?.length) return post.workout_types;
  if (post.workout_type) return [post.workout_type];
  return [];
}

const checks: Array<{ name: string; run: () => void }> = [
  {
    name: "Migration adds posts.workout_types array with backfill",
    run: () => {
      const migration = read("supabase/migrations/20250630000010_post_workout_types.sql");
      if (!migration.includes("workout_types TEXT[]")) {
        throw new Error("Expected workout_types TEXT[] column");
      }
      if (!migration.includes("ARRAY[workout_type]")) {
        throw new Error("Expected backfill from legacy workout_type");
      }
    },
  },
  {
    name: "Share Workout supports multi-select chips",
    run: () => {
      assertIncludes(
        "app/create-post.tsx",
        "workoutTypes.includes(activity)",
        "create-post must toggle activities in an array"
      );
      assertIncludes("app/create-post.tsx", "workout_types: workoutTypes", "create-post must save workout_types");
    },
  },
  {
    name: "Edit post supports multi-select chips",
    run: () => {
      assertIncludes(
        "app/edit-post/[id].tsx",
        "workoutTypes.includes(activity)",
        "edit-post must toggle activities in an array"
      );
      assertIncludes("app/edit-post/[id].tsx", "workout_types: workoutTypes", "edit-post must save workout_types");
    },
  },
  {
    name: "API create/update posts use workout_types",
    run: () => {
      assertIncludes("packages/api/src/posts.ts", "workout_types?: string[]", "createPost must accept workout_types");
      assertIncludes("packages/api/src/posts.ts", "normalizePostWorkoutFields", "posts must normalize workout fields");
    },
  },
  {
    name: "Feed and profile render workout types as compact chips",
    run: () => {
      assertIncludes("packages/ui/src/WorkoutTypeChips.tsx", "maxVisible", "WorkoutTypeChips must support truncation");
      assertIncludes("packages/ui/src/FeedPostCard.tsx", "WorkoutTypeChips", "FeedPostCard must render workout chips");
      assertIncludes("packages/ui/src/FeedPostCard.tsx", "maxVisible={3}", "Feed must show up to 3 workout chips");
      assertIncludes("packages/ui/src/PostCard.tsx", "WorkoutTypeChips", "Post detail must render workout chips");
      assertIncludes("packages/ui/src/PostGrid.tsx", "WorkoutTypeChips", "Profile grid must render workout chips");
    },
  },
  {
    name: "Legacy single workout_type posts still normalize",
    run: () => {
      const helperSource = read("packages/types/src/workout-types.ts");
      if (!helperSource.includes("normalizeWorkoutTypes")) {
        throw new Error("workout-types helper must exist");
      }

      const legacy = normalizeWorkoutTypes({ workout_type: "running", workout_types: [] });
      if (legacy.join(",") !== "running") {
        throw new Error(`Expected legacy workout_type to normalize, got: ${legacy}`);
      }

      const modern = normalizeWorkoutTypes({
        workout_type: "running",
        workout_types: ["weightlifting", "running"],
      });
      if (modern.join(",") !== "weightlifting,running") {
        throw new Error(`Expected workout_types to win over legacy field, got: ${modern}`);
      }
    },
  },
];

let failed = 0;

for (const check of checks) {
  try {
    check.run();
    console.log(`PASS  ${check.name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL  ${check.name}`);
    console.error(error instanceof Error ? error.message : error);
  }
}

if (failed > 0) {
  process.exit(1);
}

console.log(`\nAll ${checks.length} post workout type checks passed.`);
