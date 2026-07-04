/**
 * Story system redesign verification.
 * Run: npx tsx scripts/verify-story-system.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function read(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

function mustInclude(file: string, token: string, label: string) {
  const src = read(file);
  if (!src.includes(token)) {
    throw new Error(`${label}: missing "${token}" in ${file}`);
  }
}

const checks: Array<{ name: string; run: () => void }> = [
  {
    name: "sql:dedicated stories table",
    run: () => mustInclude("supabase/migrations/20250710000001_dedicated_stories.sql", "CREATE TABLE IF NOT EXISTS public.stories", "migration"),
  },
  {
    name: "sql:story_slides table",
    run: () => mustInclude("supabase/migrations/20250710000001_dedicated_stories.sql", "story_slides", "migration"),
  },
  {
    name: "sql:story_item_views",
    run: () => mustInclude("supabase/migrations/20250710000001_dedicated_stories.sql", "story_item_views", "migration"),
  },
  {
    name: "sql:story_memories",
    run: () => mustInclude("supabase/migrations/20250710000001_dedicated_stories.sql", "story_memories", "migration"),
  },
  {
    name: "sql:24h expiry",
    run: () => mustInclude("supabase/migrations/20250710000001_dedicated_stories.sql", "24 hours", "migration"),
  },
  {
    name: "sql:story_reaction notification type",
    run: () => mustInclude("supabase/migrations/20250710000001_dedicated_stories.sql", "story_reaction", "migration"),
  },
  {
    name: "api:publishStory",
    run: () => mustInclude("packages/api/src/story-publish.ts", "export async function publishStory", "api"),
  },
  {
    name: "api:getFeedStories uses active stories",
    run: () => mustInclude("packages/api/src/stories.ts", "active_stories", "api"),
  },
  {
    name: "api:dedicated story reactions",
    run: () => mustInclude("packages/api/src/story-engagement.ts", "sendDedicatedStoryReaction", "api"),
  },
  {
    name: "api:story viewers list",
    run: () => mustInclude("packages/api/src/story-engagement.ts", "getStoryViewers", "api"),
  },
  {
    name: "api:story reply notification",
    run: () => mustInclude("packages/api/src/story-engagement.ts", "story_reply", "api"),
  },
  {
    name: "ui:create-story screen",
    run: () => mustInclude("app/create-story.tsx", "publishStory", "ui"),
  },
  {
    name: "ui:create-post workout saved flow",
    run: () => mustInclude("app/create-post.tsx", "WorkoutSavedSheet", "ui"),
  },
  {
    name: "ui:story row add button",
    run: () => mustInclude("packages/ui/src/FeedStoriesRow.tsx", "addBadge", "ui"),
  },
  {
    name: "ui:viewers modal",
    run: () => mustInclude("components/story/StoryViewersModal.tsx", "Viewed By", "ui"),
  },
  {
    name: "ui:analytics modal",
    run: () => mustInclude("components/story/StoryAnalyticsModal.tsx", "Story Analytics", "ui"),
  },
  {
    name: "ui:7 story reactions",
    run: () => {
      const src = read("packages/types/src/workout-story.ts");
      if (!src.includes("Watching")) throw new Error("Watching reaction missing");
      const count = (src.match(/emoji:/g) ?? []).length;
      if (count < 7) throw new Error(`Expected 7 story reactions, found ${count}`);
    },
  },
  {
    name: "fitness:templates",
    run: () => mustInclude("lib/story-templates.ts", "Just Finished Workout", "ui"),
  },
  {
    name: "fitness:story-fitness api",
    run: () => mustInclude("packages/api/src/story-fitness.ts", "createStoryTrainingChallenge", "api"),
  },
  {
    name: "ui:viewer uses dedicated slides",
    run: () => mustInclude("components/WorkoutStoryViewer.tsx", "buildDedicatedStorySlides", "ui"),
  },
  {
    name: "ui:home feed story integration",
    run: () => mustInclude("app/(tabs)/index.tsx", "markDedicatedStoryViewed", "ui"),
  },
  {
    name: "types:active_stories on FeedStory",
    run: () => mustInclude("packages/types/src/index.ts", "active_stories", "types"),
  },
  {
    name: "api:getFeedStories filters story-only row",
    run: () => mustInclude("packages/api/src/stories.ts", "active_stories.length > 0", "api"),
  },
  {
    name: "api:share-workout story-only uses uploadStoryMedia",
    run: () => mustInclude("lib/share-workout.ts", "uploadStoryMedia", "share"),
  },
  {
    name: "api:share-workout feed-only uses uploadPostMedia",
    run: () => mustInclude("lib/share-workout.ts", "uploadPostMedia", "share"),
  },
  {
    name: "ui:viewer has no post fallback slides",
    run: () => {
      const src = read("components/WorkoutStoryViewer.tsx");
      if (src.includes("buildStorySlides")) {
        throw new Error("WorkoutStoryViewer must not fall back to post-derived slides");
      }
    },
  },
  {
    name: "ui:workout saved sheet labels",
    run: () => {
      mustInclude("components/WorkoutSavedSheet.tsx", "Post to Feed", "ui");
      mustInclude("components/WorkoutSavedSheet.tsx", "Share to Story", "ui");
      mustInclude("components/WorkoutSavedSheet.tsx", "Share to Both", "ui");
    },
  },
  {
    name: "phase3:story polls migration",
    run: () => mustInclude("supabase/migrations/20250714000001_story_phase3_engagement.sql", "story_polls", "migration"),
  },
  {
    name: "phase3:story reply dm reference",
    run: () => mustInclude("supabase/migrations/20250714000001_story_phase3_engagement.sql", "story_reply_id", "migration"),
  },
  {
    name: "phase3:realtime viewers",
    run: () => mustInclude("packages/api/src/story-engagement.ts", "subscribeStoryViewers", "api"),
  },
  {
    name: "phase3:story discovery lanes",
    run: () => mustInclude("packages/api/src/story-discovery.ts", "getStoryDiscoveryLanes", "api"),
  },
  {
    name: "phase3:story explore screen",
    run: () => mustInclude("app/stories/explore.tsx", "getStoryDiscoveryLanes", "ui"),
  },
  {
    name: "phase3:story templates",
    run: () => mustInclude("lib/story-templates.ts", "Recovery Day", "ui"),
  },
  {
    name: "phase3:instagram story reply bubble",
    run: () => mustInclude("packages/ui/src/MessageBubble.tsx", "Replied to your story", "ui"),
  },
  {
    name: "ui:your story entry point",
    run: () => mustInclude("packages/ui/src/FeedStoriesRow.tsx", "Your Story", "ui"),
  },
  {
    name: "ui:story quick actions",
    run: () => mustInclude("components/story/StoryQuickActionsBar.tsx", "Invite to Workout", "ui"),
  },
  {
    name: "ui:workout story card",
    run: () => mustInclude("components/story/StoryWorkoutSlideCard.tsx", "WORKOUT STORY", "ui"),
  },
  {
    name: "ui:story discover screen",
    run: () => mustInclude("app/stories/discover.tsx", "getStoriesByWorkoutTag", "ui"),
  },
  {
    name: "api:story discovery",
    run: () => mustInclude("packages/api/src/story-discovery.ts", "getStoriesByLocation", "api"),
  },
];

let passed = 0;
console.log("\nStory system verification\n");
for (const check of checks) {
  try {
    check.run();
    passed += 1;
    console.log(`✅ ${check.name}`);
  } catch (error) {
    console.log(`❌ ${check.name} — ${error instanceof Error ? error.message : String(error)}`);
  }
}
console.log(`\n${passed}/${checks.length} PASS\n`);
process.exit(passed === checks.length ? 0 : 1);
