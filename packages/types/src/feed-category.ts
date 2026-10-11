import type { WorkoutStoryMetrics } from "./workout-story";

/**
 * Home-feed post category. Separate from `workout_types` (activity tags)
 * and `journey_category` (Frennix Reels).
 */
export const FEED_CATEGORIES = ["workout", "nutrition", "general"] as const;

export type FeedCategory = (typeof FEED_CATEGORIES)[number];

export const FEED_CATEGORY_LABELS: Record<FeedCategory, string> = {
  workout: "Workout",
  nutrition: "Nutrition",
  general: "General",
};

export const HOME_FEED_TABS = [
  { id: "all", label: "All" },
  { id: "workouts", label: "Workouts" },
  { id: "nutrition", label: "Nutrition" },
] as const;

export type HomeFeedTab = (typeof HOME_FEED_TABS)[number]["id"];

export const COMPOSER_CATEGORY_TABS: Array<{ id: FeedCategory; label: string }> = [
  { id: "workout", label: "Workout" },
  { id: "nutrition", label: "Nutrition" },
  { id: "general", label: "General" },
];

export function isFeedCategory(value: unknown): value is FeedCategory {
  return typeof value === "string" && (FEED_CATEGORIES as readonly string[]).includes(value);
}

export function parseFeedCategory(value: unknown): FeedCategory | null {
  return isFeedCategory(value) ? value : null;
}

/** Home tab → stored category. All does not filter. */
export function feedCategoryForHomeTab(tab: HomeFeedTab): FeedCategory | null {
  if (tab === "workouts") return "workout";
  if (tab === "nutrition") return "nutrition";
  return null;
}

type WorkoutIdentity = {
  post_type?: string | null;
  workout_type?: string | null;
  workout_types?: string[] | null;
  workout_metrics?: WorkoutStoryMetrics | null;
};

function hasText(value: string | null | undefined): boolean {
  return Boolean(value && value.trim());
}

/**
 * Historical posts are workouts only when existing columns already say so.
 * A photo or caption with no workout type, tags, or stats stays uncategorized.
 */
export function isReliableWorkoutPost(post: WorkoutIdentity): boolean {
  if (post.post_type === "workout_update") return true;
  if (hasText(post.workout_type)) return true;
  if (post.workout_types?.some((type) => hasText(type))) return true;

  const metrics = post.workout_metrics;
  if (!metrics) return false;
  return (
    (metrics.duration_seconds != null && metrics.duration_seconds > 0) ||
    (metrics.distance_meters != null && metrics.distance_meters > 0) ||
    (metrics.calories != null && metrics.calories > 0)
  );
}

/** Saved category wins. Null rows fall back to a reliable workout, otherwise General. */
export function resolveFeedCategory(post: WorkoutIdentity & { feed_category?: FeedCategory | null }): FeedCategory {
  if (isFeedCategory(post.feed_category)) return post.feed_category;
  return isReliableWorkoutPost(post) ? "workout" : "general";
}
