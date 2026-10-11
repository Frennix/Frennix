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
      if (!src.includes("StoryCompletionBadge")) {
        throw new Error("Completed commitments must use the story completion badge");
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
    name: "Workout story viewer uses the shared fade, quick actions, and insights",
    run: () => {
      const viewer = read("components/WorkoutStoryViewer.tsx");
      for (const token of [
        "StoryHeaderFade",
        "StoryFooterGradient",
        "StoryInsightsStrip",
        "StoryQuickActionsBar",
        "StoryReactionRow",
        "StoryCompletionBadge",
        "onReact",
        "onInviteToTrain",
        "presentationStyle=\"fullScreen\"",
      ]) {
        if (!viewer.includes(token)) throw new Error(`Missing ${token}`);
      }
      if (viewer.includes("StoryActionDock") || viewer.includes("scrimTop")) {
        throw new Error("Story viewer must keep the gradient chrome instead of the old dock and top bar");
      }
    },
  },
  {
    name: "Story auto-advance pauses while reply composer is open",
    run: () => {
      const viewer = read("components/WorkoutStoryViewer.tsx");
      const reply = read("components/story/StoryReplyBar.tsx");
      if (!viewer.includes("interactionLocked") || !viewer.includes("autoAdvancePaused")) {
        throw new Error("Story viewer must pause auto-advance while interactions are active");
      }
      if (!viewer.includes("onFocusChange={setInteractionLocked}")) {
        throw new Error("Reply field focus must pause auto-advance");
      }
      if (!reply.includes("onFocusChange?.(true)") || !reply.includes("onFocusChange?.(false)")) {
        throw new Error("Reply composer must report focus so playback can pause");
      }
      if (!viewer.includes("setShowReply(false)")) {
        throw new Error("Reply composer must close after send to resume auto-advance");
      }
    },
  },
  {
    name: "Story actions stay in the quick actions bar and reaction row",
    run: () => {
      const viewer = read("components/WorkoutStoryViewer.tsx");
      const actions = read("components/story/StoryQuickActionsBar.tsx");
      const reactions = read("components/story/StoryReactionRow.tsx");
      if (!viewer.includes("<StoryQuickActionsBar") || !viewer.includes("<StoryReactionRow")) {
        throw new Error("Story viewer must use the quick actions bar and reaction row");
      }
      for (const label of ["Message", "Invite to Workout", "Invite to Event", "View Profile"]) {
        if (!actions.includes(label)) throw new Error(`Missing story action ${label}`);
      }
      if (!reactions.includes("STORY_QUICK_REACTIONS.map((reaction)")) {
        throw new Error("Reactions must stay in the reaction row");
      }
      if (viewer.includes("StoryActionDock")) {
        throw new Error("Story viewer must not mount the old action dock");
      }
    },
  },
  {
    name: "Story viewer has prominent close control and safe areas",
    run: () => {
      const viewer = read("components/WorkoutStoryViewer.tsx");
      if (!viewer.includes("useSafeAreaInsets")) {
        throw new Error("Story viewer must respect safe area insets");
      }
      if (!viewer.includes("touchTarget")) {
        throw new Error("Close button must meet touch target size");
      }
      if (!viewer.includes("accessibilityHint")) {
        throw new Error("Close button must describe swipe-down dismiss");
      }
      if (!viewer.includes("StoryFooterGradient")) {
        throw new Error("Story footer must use readable caption gradient");
      }
      if (!viewer.includes("StoryHeaderFade")) {
        throw new Error("Story header must use a fading top overlay");
      }
      if (viewer.includes("scrimTop") || viewer.includes('height: 180,\n    backgroundColor: "rgba(10, 10, 11, 0.55)"')) {
        throw new Error("Story viewer must not use a solid top rectangle");
      }
      if (viewer.includes("Story insights will appear as people engage")) {
        throw new Error("Empty insights copy belongs in the owner panel, not on the photo");
      }
      const viewers = read("components/story/StoryViewersModal.tsx");
      const analytics = read("components/story/StoryAnalyticsModal.tsx");
      const fade = read("components/story/StoryFooterGradient.tsx");
      if (!viewers.includes("Story insights will appear as people engage")) {
        throw new Error("Viewer panel must explain that insights appear as people engage");
      }
      if (!analytics.includes("Story insights will appear as people engage")) {
        throw new Error("Insights panel must explain that insights appear as people engage");
      }
      if (!fade.includes('pointerEvents="none"') || !fade.includes('stopOpacity={stop.opacity}')) {
        throw new Error("Story fades must be smooth gradients that do not receive taps");
      }
      if (fade.includes("nativeBandStrong")) {
        throw new Error("Story footer fade must not use stacked solid bands");
      }
    },
  },
  {
    name: "Story reactions confirm on the current slide",
    run: () => {
      const viewer = read("components/WorkoutStoryViewer.tsx");
      const reactions = read("components/story/StoryReactionRow.tsx");
      if (!viewer.includes("confirmedReaction") || !viewer.includes("shouldAcceptReactionConfirmation")) {
        throw new Error("Story viewer must confirm the reaction for the current slide");
      }
      if (!reactions.includes("applyStoryReactionSuccess")) {
        throw new Error("Reaction row must record a successful reaction");
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
        "markStoryViewedOptimistic",
        "sendDedicatedStoryReaction",
        "sendStoryChallenge",
        "sendDedicatedStoryReply",
        "getDedicatedStoryInsights",
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
    name: "Feed scrolls while story viewer is closed",
    run: () => {
      const feed = read("app/(tabs)/index.tsx");
      if (!feed.includes("const feedScrollEnabled = !storyVisible") || !feed.includes("scrollEnabled={feedScrollEnabled}")) {
        throw new Error("Feed scrolling must be disabled while the story viewer is open");
      }
      if (!feed.includes("feedList:") || !feed.includes("flexFill")) {
        throw new Error("Feed scroll list must use flexFill for vertical scroll");
      }
      if (!feed.includes("nestedScrollEnabled")) {
        throw new Error("Feed FlatList must enable nestedScrollEnabled for story row");
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
      const createStory = read("app/create-story.tsx");
      if (!createStory.includes("StoryPrivacySelector")) {
        throw new Error("Create story must keep the story privacy selector");
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
