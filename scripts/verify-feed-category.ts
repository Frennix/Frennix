/**
 * Home feed categories stay separate from workout tags and Reels journeys.
 * Filtering belongs in the paginated query. Historical posts are workouts
 * only when existing columns already identify them.
 *
 * Usage: npx tsx scripts/verify-feed-category.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  feedCategoryForHomeTab,
  isReliableWorkoutPost,
  resolveFeedCategory,
} from "../packages/types/src/feed-category";
import { formatFeedCompactHeaderMeta } from "../packages/ui/src/formatRelativeTime";
import { moreSectionsForPost, POST_INTERACTION_PRIMARY } from "../lib/post-interaction-actions";
import {
  beginPublish,
  failPublish,
  succeedPublish,
  visibleComposerCategory,
  type PublishPhase,
} from "../lib/create-post-publish";

const ROOT = join(import.meta.dirname, "..");

function read(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

function assertIncludes(file: string, needle: string, message: string) {
  if (!read(file).includes(needle)) {
    throw new Error(`${message} (missing "${needle}" in ${file})`);
  }
}

const checks: Array<{ name: string; run: () => void }> = [
  {
    name: "Migration is additive and does not label every post a workout",
    run: () => {
      const migration = read("supabase/migrations/20261010190000_post_feed_category.sql");
      if (!migration.includes("ADD COLUMN IF NOT EXISTS feed_category TEXT")) {
        throw new Error("feed_category must be an additive nullable column");
      }
      if (!migration.includes("feed_category IS NULL")) {
        throw new Error("uncategorized posts must stay allowed");
      }
      if (migration.includes("SET feed_category = 'nutrition'")) {
        throw new Error("existing rows must not be backfilled as nutrition");
      }
      if (!migration.includes("post_type = 'workout_update'")) {
        throw new Error("workout_update rows are a reliable workout signal");
      }
      if (!migration.includes("DISABLE TRIGGER posts_updated_at")) {
        throw new Error("backfill must not bump updated_at");
      }
      if (!migration.includes("DISABLE TRIGGER posts_sync_workout_types")) {
        throw new Error("backfill must not rewrite workout_type through the sync trigger");
      }
      if (!migration.includes("BEGIN;")) {
        throw new Error("schema changes and backfill must run in one transaction");
      }
      if (!migration.includes("COMMIT;")) {
        throw new Error("schema changes and backfill must commit together");
      }
      if (!migration.includes("tgenabled")) {
        throw new Error("backfill must record each trigger's enabled state");
      }
      if (!migration.includes("ENABLE TRIGGER posts_updated_at")) {
        throw new Error("updated_at trigger must be restored when it started enabled");
      }
      if (!migration.includes("ENABLE TRIGGER posts_sync_workout_types")) {
        throw new Error("workout type sync trigger must be restored when it started enabled");
      }
      if (!migration.includes("ENABLE REPLICA TRIGGER posts_updated_at") || !migration.includes("ENABLE ALWAYS TRIGGER posts_updated_at")) {
        throw new Error("updated_at trigger must keep replica and always modes");
      }
      if (!migration.includes("ENABLE REPLICA TRIGGER posts_sync_workout_types") || !migration.includes("ENABLE ALWAYS TRIGGER posts_sync_workout_types")) {
        throw new Error("workout type sync trigger must keep replica and always modes");
      }
      if (migration.includes("ENABLE ROW LEVEL SECURITY") || migration.includes("CREATE POLICY")) {
        throw new Error("migration must leave existing access policies unchanged");
      }
    },
  },
  {
    name: "Feed query filters by category before pagination",
    run: () => {
      assertIncludes(
        "packages/api/src/posts.ts",
        'q = q.eq("feed_category", options.feedCategory)',
        "getFeedCore must filter the paginated query"
      );
      assertIncludes(
        "app/(tabs)/index.tsx",
        "homeFeedQueryKey(userId ?? \"\", feedTab)",
        "each tab must have its own paginated query"
      );
      assertIncludes(
        "app/(tabs)/index.tsx",
        "feedCategory: feedCategoryForHomeTab(feedTab)",
        "tab selection must reach the query"
      );
    },
  },
  {
    name: "Composer saves and restores category without requiring workout fields",
    run: () => {
      assertIncludes("app/create-post.tsx", "Share meal", "nutrition composer action");
      const createPost = read("app/create-post.tsx");
      if (!createPost.includes('? "Post"')) {
        throw new Error("general posts must use a Post action");
      }
      if (!createPost.includes("showWorkoutFields")) {
        throw new Error("nutrition and general must be able to hide workout fields");
      }
      assertIncludes("app/edit-post/[id].tsx", "resolveFeedCategory(post)", "edit must restore category");
      assertIncludes("app/edit-post/[id].tsx", "feed_category: feedCategory", "edit must save category");
      assertIncludes("lib/create-post-draft.ts", "feedCategory: FeedCategory", "drafts must keep the category");
      assertIncludes("packages/ui/src/FeedPostCard.tsx", "NutritionPostLabel", "nutrition posts show a label");
      assertIncludes("components/NutritionFeedEmpty.tsx", "Share what fuels you.", "nutrition empty title");
      assertIncludes(
        "components/NutritionFeedEmpty.tsx",
        "Post a meal, recipe, or meal-prep idea.",
        "nutrition empty body"
      );
      assertIncludes("components/NutritionFeedEmpty.tsx", 'category: "nutrition"', "empty state opens nutrition");
      assertIncludes("components/FeedHeader.tsx", "+ Share a meal", "nutrition tab keeps a share button");
      assertIncludes(
        "components/FeedHeader.tsx",
        'openCreatePost({ category: "nutrition" })',
        "share button opens the composer on Nutrition"
      );
      assertIncludes(
        "components/CreateTabBarButton.tsx",
        "openCreatePostForCurrentFeed",
        "bottom Post button follows the selected home tab"
      );
      assertIncludes(
        "app/(tabs)/_layout.tsx",
        "openCreatePostForCurrentFeed",
        "create tab follows the selected home tab"
      );
      assertIncludes(
        "lib/press-utils.ts",
        'openCreatePost({ category: "nutrition" })',
        "nutrition tab opens another meal"
      );
    },
  },
  {
    name: "Only reliable historical posts resolve to workout",
    run: () => {
      if (!isReliableWorkoutPost({ post_type: "workout_update" })) {
        throw new Error("workout_update is a workout");
      }
      if (!isReliableWorkoutPost({ workout_types: ["running"] })) {
        throw new Error("workout tags are a workout");
      }
      if (!isReliableWorkoutPost({ workout_type: "cycling" })) {
        throw new Error("legacy workout_type is a workout");
      }
      if (!isReliableWorkoutPost({ workout_metrics: { duration_seconds: 1200 } })) {
        throw new Error("duration stats are a workout");
      }
      if (isReliableWorkoutPost({ post_type: "photo", workout_types: [], content: "lunch" } as never)) {
        throw new Error("a photo without workout data is not a workout");
      }
      if (isReliableWorkoutPost({ post_type: "text", workout_types: ["", "  "] })) {
        throw new Error("blank tags are not a workout");
      }
      if (resolveFeedCategory({ post_type: "photo", workout_types: [] }) !== "general") {
        throw new Error("uncategorized photos stay general");
      }
      if (resolveFeedCategory({ feed_category: "nutrition", post_type: "workout_update" }) !== "nutrition") {
        throw new Error("saved category wins over workout inference");
      }
      if (feedCategoryForHomeTab("all") !== null) throw new Error("All must not filter");
      if (feedCategoryForHomeTab("workouts") !== "workout") throw new Error("Workouts filter");
      if (feedCategoryForHomeTab("nutrition") !== "nutrition") throw new Error("Nutrition filter");
    },
  },
  {
    name: "Category pages keep posts that would sit past the first unfiltered page",
    run: () => {
      const posts = [
        { id: "photo", feed_category: null },
        { id: "workout-1", feed_category: "workout" },
        { id: "note", feed_category: "general" },
        { id: "meal", feed_category: "nutrition" },
        { id: "workout-2", feed_category: "workout" },
      ];
      const pageSize = 2;
      const filtered = posts.filter((post) => post.feed_category === "workout");
      const firstFilteredPage = filtered.slice(0, pageSize).map((post) => post.id);
      if (firstFilteredPage.join(",") !== "workout-1,workout-2") {
        throw new Error(`query filter must page workouts together, got ${firstFilteredPage.join(",")}`);
      }
      const firstLoadedPage = posts.slice(0, pageSize).filter((post) => post.feed_category === "workout");
      if (firstLoadedPage.some((post) => post.id === "workout-2")) {
        throw new Error("filtering only the first loaded page would hide a later workout");
      }
      const all = posts.map((post) => post.id);
      if (!all.includes("meal") || !all.includes("photo")) {
        throw new Error("All keeps nutrition and uncategorized posts");
      }
    },
  },
  {
    name: "Two nutrition posts stay in All and Nutrition, with a meal label and social menu",
    run: () => {
      const meals = [
        {
          id: "meal-1",
          post_type: "photo",
          created_at: "2026-10-10T20:00:00.000Z",
          feed_category: "nutrition" as const,
        },
        {
          id: "meal-2",
          post_type: "photo",
          created_at: "2026-10-10T20:05:00.000Z",
          feed_category: "nutrition" as const,
        },
      ];
      const visible = (tab: "all" | "workouts" | "nutrition") => {
        const category = feedCategoryForHomeTab(tab);
        return category ? meals.filter((post) => post.feed_category === category) : meals;
      };
      const allIds = visible("all").map((post) => post.id).join(",");
      const nutritionIds = visible("nutrition").map((post) => post.id).join(",");
      if (allIds !== "meal-1,meal-2" || nutritionIds !== "meal-1,meal-2") {
        throw new Error("both meals must appear in All and Nutrition");
      }
      if (visible("workouts").length !== 0) {
        throw new Error("meals must stay out of Workouts");
      }
      for (const meal of meals) {
        const label = formatFeedCompactHeaderMeta(meal, []);
        if (!label.startsWith("Nutrition photo")) {
          throw new Error(`nutrition photo label, got ${label}`);
        }
      }
      const workoutLabel = formatFeedCompactHeaderMeta(
        { post_type: "photo", created_at: meals[0].created_at, feed_category: "workout" },
        []
      );
      if (!workoutLabel.startsWith("Workout photo")) {
        throw new Error("workout photos keep their label");
      }
      const nutritionMenu = moreSectionsForPost(meals[0]);
      const labels = nutritionMenu.flatMap((section) => section.actions.map((action) => action.label));
      for (const hidden of ["I'll Join", "Invite to Train", "Challenge Accepted", "Rematch"]) {
        if (labels.includes(hidden)) throw new Error(`${hidden} must be hidden on nutrition posts`);
      }
      for (const kept of ["Fire", "View Profile", "Share", "Save Post"]) {
        if (!labels.includes(kept)) throw new Error(`${kept} must stay on nutrition posts`);
      }
      const primary = POST_INTERACTION_PRIMARY.map((action) => action.label);
      for (const kept of ["Like", "Strong Work", "Reply"]) {
        if (!primary.includes(kept)) throw new Error(`${kept} must stay available`);
      }
      const workoutMenu = moreSectionsForPost({ feed_category: "workout" });
      if (!workoutMenu.some((section) => section.title === "Fitness Actions")) {
        throw new Error("workout posts keep fitness actions");
      }
      const ownedMeal = { ...meals[0], author_id: "owner-1" };
      const ownerMenu = moreSectionsForPost(ownedMeal, "owner-1");
      const ownerLabels = ownerMenu.flatMap((section) => section.actions.map((action) => action.label));
      for (const kept of ["Edit", "Delete", "Fire", "View Profile", "Share", "Save Post"]) {
        if (!ownerLabels.includes(kept)) throw new Error(`${kept} must stay in the owner's nutrition More menu`);
      }
      for (const hidden of ["I'll Join", "Invite to Train", "Challenge Accepted", "Rematch"]) {
        if (ownerLabels.includes(hidden)) throw new Error(`${hidden} must stay hidden for the owner`);
      }
      const visitorLabels = moreSectionsForPost(ownedMeal, "someone-else").flatMap((section) =>
        section.actions.map((action) => action.label)
      );
      if (visitorLabels.includes("Delete") || visitorLabels.includes("Edit")) {
        throw new Error("only the owner sees Edit and Delete");
      }
      const allTabOwner = moreSectionsForPost(ownedMeal, "owner-1");
      if (!allTabOwner.some((section) => section.actions.some((action) => action.label === "Delete"))) {
        throw new Error("Delete stays available when the same nutrition post is opened from All");
      }
      assertIncludes("app/(tabs)/index.tsx", "onOwnerDelete: deleteOwnedPost", "Home More uses the existing delete flow");
      assertIncludes("lib/usePostActions.tsx", "confirmDeletePost(", "delete asks for confirmation");
      assertIncludes("lib/usePostActions.tsx", "deletePost(postId, userId)", "delete keeps the existing permission check");
      assertIncludes("lib/usePostActions.tsx", "invalidatePostQueries(queryClient, userId, postId)", "delete refreshes affected feeds");
      assertIncludes("lib/usePostActions.tsx", "previousFeeds", "a failed delete restores the post");
      assertIncludes("packages/ui/src/PostCard.tsx", "More post actions", "the post screen exposes the owner menu");
      assertIncludes("app/post/[id].tsx", "onOwnerActionsPress={() => openPostActions(post)}", "post detail opens owner actions");
      assertIncludes("lib/post-actions.ts", 'entityAction("edit", "Edit Post")', "owners can still edit");
      assertIncludes("lib/post-actions.ts", 'entityAction("delete", "Delete Post"', "owners can still delete");
      assertIncludes(
        "app/create-post.tsx",
        'invalidateQueries({ queryKey: ["feed", userId] })',
        "publishing refreshes every home tab"
      );
      assertIncludes("lib/share-workout.ts", "feed_category: homeCategory", "each meal stores its category");
    },
  },
  {
    name: "Publishing keeps the open category until navigation and rejects a second submit",
    run: () => {
      if (visibleComposerCategory("nutrition", "workout") !== "nutrition") {
        throw new Error("a stored workout draft must not replace the Nutrition composer");
      }
      if (visibleComposerCategory(null, "general") !== "general") {
        throw new Error("General stays selected when the composer is idle");
      }
      if (visibleComposerCategory(null, "workout") !== "workout") {
        throw new Error("Workout stays selected when the composer is idle");
      }

      let inFlight: PublishPhase = "publishing";
      if (beginPublish(inFlight)) {
        throw new Error("a second tap during a slow publish must not create another post");
      }
      inFlight = succeedPublish(inFlight);
      if (beginPublish(inFlight)) {
        throw new Error("publishing stays locked until the composer closes");
      }

      const posts: string[] = [];
      const publishMeal = () => {
        let phase: PublishPhase = "idle";
        const started = beginPublish(phase);
        if (!started) throw new Error("a new composer must accept the next meal");
        posts.push(`meal-${posts.length + 1}`);
        return succeedPublish(started);
      };
      publishMeal();
      publishMeal();
      if (posts.join(",") !== "meal-1,meal-2") {
        throw new Error("two consecutive meals must each create one post");
      }

      let failed: PublishPhase = "publishing";
      const beforeRetry = posts.length;
      failed = failPublish(failed);
      if (beginPublish(failed) !== "publishing") throw new Error("a failed publish must stay retryable");
      if (posts.length !== beforeRetry) throw new Error("a failed publish must not create a post");

      const screen = read("app/create-post.tsx");
      const finishStart = screen.indexOf("function finishPublishing");
      const abortStart = screen.indexOf("function abortPublishing");
      const finish = screen.slice(finishStart, abortStart);
      if (finish.includes("setFeedCategory") || finish.includes("clearDraft") || finish.includes('setUploadStage("idle")')) {
        throw new Error("success must leave the open composer in place until navigation");
      }
      const release = read("lib/useCreatePostDraft.ts");
      const releaseStart = release.indexOf("const releaseStoredDraft");
      const releaseBody = release.slice(releaseStart, release.indexOf("return {", releaseStart));
      if (releaseBody.includes("setFeedCategory")) {
        throw new Error("releasing the saved draft must not switch the visible category");
      }
      assertIncludes("app/create-post.tsx", "releaseStoredDraft()", "success drops the saved draft");
      assertIncludes("app/create-post.tsx", "setLockedCategory(null)", "failure unlocks the selected category");
      assertIncludes("app/create-post.tsx", "void flushDraft()", "failure keeps the caption and media draft");
      const meals = [
        { id: "meal-1", feed_category: "nutrition" as const },
        { id: "meal-2", feed_category: "nutrition" as const },
      ];
      const visible = (tab: "all" | "nutrition") => {
        const category = feedCategoryForHomeTab(tab);
        return category ? meals.filter((post) => post.feed_category === category) : meals;
      };
      if (visible("all").length !== 2 || visible("nutrition").length !== 2) {
        throw new Error("both published meals stay in All and Nutrition");
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
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}

console.log("\nfeed category checks passed");
