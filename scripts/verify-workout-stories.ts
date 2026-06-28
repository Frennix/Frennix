/**
 * Regression checks for Workout Story viewer (Instagram-style, not post detail).
 * Run: pnpm verify:workout-stories
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function read(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

const checks: Array<{ name: string; run: () => void }> = [
  {
    name: "Dedicated WorkoutStoryViewer component exists",
    run: () => {
      const src = read("components/WorkoutStoryViewer.tsx");
      if (!src.includes("export function WorkoutStoryViewer")) {
        throw new Error("WorkoutStoryViewer must be exported");
      }
    },
  },
  {
    name: "Story viewer is full-screen modal, not page sheet post layout",
    run: () => {
      const src = read("components/WorkoutStoryViewer.tsx");
      if (src.includes('presentationStyle="pageSheet"')) {
        throw new Error("Story viewer must not use pageSheet presentation");
      }
      if (!src.includes("statusBarTranslucent")) {
        throw new Error("Story viewer must be full-screen");
      }
      if (src.includes("transparent")) {
        throw new Error("Story viewer must use opaque modal (no transparent prop)");
      }
      if (!src.includes('presentationStyle="fullScreen"')) {
        throw new Error("Story viewer must use fullScreen presentation");
      }
      if (src.includes("PostMediaCarousel")) {
        throw new Error("Story viewer must not reuse feed PostMediaCarousel");
      }
    },
  },
  {
    name: "Story viewer has progress bars and tap navigation",
    run: () => {
      const src = read("components/WorkoutStoryViewer.tsx");
      if (!src.includes("StoryProgressBars")) throw new Error("Progress bars required");
      if (!src.includes("tapZoneLeft") || !src.includes("tapZoneRight")) {
        throw new Error("Left/right tap zones required");
      }
      if (!src.includes("PanResponder")) throw new Error("Swipe-down dismiss required");
    },
  },
  {
    name: "Story viewer shows profile overlay without feed action buttons",
    run: () => {
      const src = read("components/WorkoutStoryViewer.tsx");
      if (!src.includes("<Avatar")) throw new Error("Profile avatar required in overlay");
      if (!src.includes("WorkoutCompletionCard")) {
        throw new Error("Workout completion card required");
      }
      if (src.includes("View post")) {
        throw new Error("Story viewer must not show feed/post action buttons");
      }
    },
  },
  {
    name: "Feed wires stories array into viewer without post detail navigation",
    run: () => {
      const feed = read("app/(tabs)/index.tsx");
      if (!feed.includes("stories={stories}")) {
        throw new Error("Feed must pass stories array to viewer");
      }
      if (!feed.includes("activeStoryIndex")) {
        throw new Error("Feed must track active story index");
      }
      if (feed.includes("onViewPost")) {
        throw new Error("Feed story flow must not navigate to post detail");
      }
    },
  },
  {
    name: "Caption renders in story footer not feed post body",
    run: () => {
      const src = read("components/WorkoutStoryViewer.tsx");
      if (!src.includes("captionText")) {
        throw new Error("Caption must use story footer styling");
      }
    },
  },
  {
    name: "Workout Stories 2.0 UI: action dock, motivation, insights",
    run: () => {
      const viewer = read("components/WorkoutStoryViewer.tsx");
      for (const token of [
        "StoryActionDock",
        "StoryDailyMotivation",
        "StoryInsightsStrip",
        "WorkoutCompletionCard",
        "StoryAchievementMoment",
        "onReact",
        "onInviteToTrain",
        "presentationStyle=\"fullScreen\"",
      ]) {
        if (!viewer.includes(token)) throw new Error(`Missing ${token}`);
      }
    },
  },
  {
    name: "Story auto-advance with pause on press/hold",
    run: () => {
      const src = read("components/WorkoutStoryViewer.tsx");
      if (!src.includes("STORY_SLIDE_DURATION_MS")) {
        throw new Error("Auto-advance duration required");
      }
      if (!src.includes("beginHold") || !src.includes("endHold")) {
        throw new Error("Press/hold pause handlers required");
      }
      if (!src.includes("setPaused")) throw new Error("Paused state required for hold");
    },
  },
  {
    name: "Feed wires fitness-first story callbacks",
    run: () => {
      const feed = read("app/(tabs)/index.tsx");
      for (const token of [
        "markStoryViewed",
        "sendStoryQuickReaction",
        "sendStoryChallenge",
        "sendStoryReply",
        "sendStoryInviteToTrain",
        "getStoryInsights",
        "onMarkViewed",
        "onReact",
        "onChallenge",
        "onFollow",
        "onInviteToTrain",
      ]) {
        if (!feed.includes(token)) throw new Error(`Feed missing ${token}`);
      }
    },
  },
  {
    name: "Feed is hidden while story viewer is open",
    run: () => {
      const feed = read("app/(tabs)/index.tsx");
      if (!feed.includes("feedHiddenWhileStory")) {
        throw new Error("Feed must hide while story is open");
      }
      if (!feed.includes("scrollEnabled={!storyVisible}")) {
        throw new Error("Feed scrolling must be disabled while story is open");
      }
    },
  },
  {
    name: "Story rings use viewed state (green unviewed, gray viewed)",
    run: () => {
      const row = read("packages/ui/src/FeedStoriesRow.tsx");
      if (!row.includes("story.viewed")) throw new Error("FeedStoriesRow must use story.viewed");
      if (!row.includes("avatarRingUnviewed") || !row.includes("avatarRingViewed")) {
        throw new Error("Unviewed/viewed ring styles required");
      }
    },
  },
  {
    name: "Workout Stories 2.0 API, privacy, invites, and architecture",
    run: () => {
      const engagement = read("packages/api/src/story-engagement.ts");
      for (const fn of ["sendStoryQuickReaction", "trackStoryProfileVisit"]) {
        if (!engagement.includes(`export async function ${fn}`)) {
          throw new Error(`Missing ${fn}`);
        }
      }
      const invites = read("packages/api/src/story-train-invites.ts");
      if (!invites.includes("sendStoryTrainInvite")) {
        throw new Error("Missing sendStoryTrainInvite");
      }
      const insights = read("packages/api/src/story-insights.ts");
      if (!insights.includes("getStoryInsights")) throw new Error("Missing getStoryInsights");
      const types = read("packages/types/src/workout-story.ts");
      for (const token of [
        "STORY_QUICK_REACTIONS",
        "STORY_DAILY_MOTIVATIONS",
        "STORY_HIGHLIGHT_PRESETS",
        "first_workout",
        "routeMap",
        "aiSummary",
      ]) {
        if (!types.includes(token)) throw new Error(`Missing type ${token}`);
      }
      const migration = read("supabase/migrations/20250630000013_workout_stories_2.sql");
      for (const token of ["story_audience", "story_train_invites", "story_highlights"]) {
        if (!migration.includes(token)) throw new Error(`Migration missing ${token}`);
      }
      const createPost = read("app/create-post.tsx");
      if (!createPost.includes("story_audience")) {
        throw new Error("Create post must support story audience");
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
    console.error(`FAIL  ${check.name}: ${error instanceof Error ? error.message : error}`);
  }
}

if (failed) process.exit(1);
console.log(`\nAll ${checks.length} workout story checks passed.`);
