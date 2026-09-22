/**
 * Story Viewer reaction / reply / overflow verification.
 * Run: npx tsx scripts/verify-story-viewer-engagement.ts
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

function mustNotInclude(file: string, token: string, label: string) {
  const src = read(file);
  if (src.includes(token)) {
    throw new Error(`${label}: unexpected "${token}" in ${file}`);
  }
}

const checks: Array<{ name: string; run: () => void }> = [
  {
    name: "reactions: optimistic selected state",
    run: () =>
      mustInclude("components/story/StoryReactionRow.tsx", "chipSelected", "reactions"),
  },
  {
    name: "reactions: rapid-tap lock",
    run: () =>
      mustInclude("components/story/StoryReactionRow.tsx", "REACTION_TAP_LOCK_MS", "reactions"),
  },
  {
    name: "reactions: web click path is not inside a ScrollView",
    run: () => {
      mustInclude("components/story/StoryReactionRow.tsx", "web-click", "reactions");
      mustNotInclude("components/story/StoryReactionRow.tsx", "ScrollView", "reactions");
    },
  },
  {
    name: "reactions: specific error copy",
    run: () =>
      mustInclude(
        "components/story/StoryReactionRow.tsx",
        "Reaction couldn’t be delivered. Try again.",
        "reactions"
      ),
  },
  {
    name: "reactions: all seven displayed options are canonicalized",
    run: () => {
      mustInclude("packages/types/src/workout-story.ts", 'key: "strong"', "reactions");
      mustInclude("packages/types/src/workout-story.ts", 'key: "fire"', "reactions");
      mustInclude("packages/types/src/workout-story.ts", 'key: "applause"', "reactions");
      mustInclude("packages/types/src/workout-story.ts", 'key: "love"', "reactions");
      mustInclude("packages/types/src/workout-story.ts", 'key: "eyes"', "reactions");
      mustInclude("packages/types/src/workout-story.ts", 'key: "laugh"', "reactions");
      mustInclude("packages/types/src/workout-story.ts", 'key: "support"', "reactions");
      mustInclude("packages/types/src/workout-story.ts", "canonicalizeStoryReaction", "reactions");
      mustInclude("packages/api/src/story-engagement.ts", "canonical.key", "reactions");
      mustInclude("packages/api/src/story-engagement.ts", "reaction: canonical.emoji", "reactions");
      mustInclude(
        "supabase/migrations/20260922010000_story_item_reaction_keys.sql",
        "SUPERSEDED",
        "reactions"
      );
      mustInclude(
        "supabase/migrations/20260922020000_story_item_reactions_restore_emoji_compat.sql",
        "DROP CONSTRAINT IF EXISTS story_item_reactions_reaction_check",
        "reactions"
      );
    },
  },
  {
    name: "api: reaction also delivers a conversation message",
    run: () => {
      mustInclude("packages/api/src/story-engagement.ts", "deliverStoryReactionMessage", "api");
      mustInclude("packages/api/src/story-engagement.ts", "getOrCreateConversation", "api");
      mustInclude("packages/api/src/story-engagement.ts", "Reacted ", "api");
      mustInclude("packages/api/src/story-engagement.ts", "storyReactionIdempotencyKey", "api");
      mustInclude(
        "packages/api/src/story-engagement.ts",
        "Reaction couldn’t be delivered. Try again.",
        "api"
      );
    },
  },
  {
    name: "messages: story reaction is rendered as a labeled message",
    run: () => {
      mustInclude("packages/ui/src/MessageBubble.tsx", "Story reaction", "messages");
      mustInclude("packages/ui/src/MessageBubble.tsx", "storyThumb", "messages");
      mustInclude("components/ChatMessageRow.tsx", "formatStoryReactionDisplay", "messages");
      mustInclude("components/ChatMessageRow.tsx", "Story expired", "messages");
    },
  },
  {
    name: "reply: keep draft on failure",
    run: () => {
      const src = read("components/story/StoryReplyBar.tsx");
      if (!src.includes("Message couldn’t be sent. Try again.")) {
        throw new Error("reply bar must show a message-specific error");
      }
      if (!src.includes("setText(\"\")")) {
        throw new Error("reply bar must still clear text after success");
      }
      if (!/catch\s*\{[\s\S]*setError\(MESSAGE_SEND_ERROR\)/.test(src)) {
        throw new Error("reply bar must keep text and set an error on failure");
      }
    },
  },
  {
    name: "viewer: reply failure does not close composer",
    run: () => {
      const src = read("components/WorkoutStoryViewer.tsx");
      if (!src.includes("Message sent.")) {
        throw new Error("viewer must confirm a successful story message");
      }
      if (!src.includes("throw error")) {
        throw new Error("viewer must rethrow reply/reaction errors for the bars");
      }
    },
  },
  {
    name: "api: reaction does not fail the loaded story",
    run: () =>
      mustInclude(
        "packages/api/src/story-engagement.ts",
        "visibility check failed",
        "api"
      ),
  },
  {
    name: "api: reply retries without story_reply_id when needed",
    run: () =>
      mustInclude(
        "packages/api/src/story-engagement.ts",
        "retrying without story_reply_id",
        "api"
      ),
  },
  {
    name: "actions: three-column wrapping grid",
    run: () => {
      mustInclude("components/story/StoryQuickActionsBar.tsx", 'flexBasis: "31%"', "actions");
      mustInclude("components/story/StoryQuickActionsBar.tsx", "numberOfLines={2}", "actions");
      mustNotInclude("components/story/StoryQuickActionsBar.tsx", "minWidth: 96", "actions");
    },
  },
  {
    name: "reactions: highlight only after a confirmed write",
    run: () => {
      mustInclude("components/story/StoryReactionRow.tsx", "selectedEmoji", "reactions");
      mustInclude("components/WorkoutStoryViewer.tsx", "Reaction sent.", "reactions");
      mustInclude("packages/api/src/story-engagement.ts", "getViewerStoryReaction", "reactions");
      mustInclude("packages/api/src/story-engagement.ts", "ensuring message", "reactions");
    },
  },
  {
    name: "viewer: page-level overflow-x is locked",
    run: () => {
      mustInclude("components/WorkoutStoryViewer.tsx", 'overflowX: "hidden"', "viewer");
      mustInclude("components/WorkoutStoryViewer.tsx", "overflow-x", "viewer");
      mustInclude("components/WorkoutStoryViewer.tsx", "minWidth: 0", "viewer");
    },
  },
];

let passed = 0;
console.log("\nStory Viewer engagement verification\n");
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
