/**
 * Story Controls verification.
 * Run: npx tsx scripts/verify-story-controls.ts
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
    name: "sql:commenting_enabled",
    run: () =>
      mustInclude(
        "supabase/migrations/20260909120000_story_controls.sql",
        "commenting_enabled",
        "migration"
      ),
  },
  {
    name: "sql:privacy connections and only_me",
    run: () =>
      mustInclude(
        "supabase/migrations/20260909120000_story_controls.sql",
        "'connections', 'only_me'",
        "migration"
      ),
  },
  {
    name: "sql:can_view_story",
    run: () =>
      mustInclude("supabase/migrations/20260909120000_story_controls.sql", "can_view_story", "migration"),
  },
  {
    name: "sql:private stories bucket",
    run: () =>
      mustInclude(
        "supabase/migrations/20260909120000_story_controls.sql",
        "VALUES ('stories', 'stories', false)",
        "migration"
      ),
  },
  {
    name: "sql:reply trigger",
    run: () =>
      mustInclude(
        "supabase/migrations/20260909120000_story_controls.sql",
        "enforce_story_reply_access",
        "migration"
      ),
  },
  {
    name: "api:deleteStory",
    run: () => mustInclude("packages/api/src/story-controls.ts", "export async function deleteStory", "api"),
  },
  {
    name: "api:updateStoryControls",
    run: () =>
      mustInclude("packages/api/src/story-controls.ts", "export async function updateStoryControls", "api"),
  },
  {
    name: "api:private upload prefix",
    run: () =>
      mustInclude("packages/api/src/story-publish.ts", "STORY_PRIVATE_MEDIA_PREFIX", "api"),
  },
  {
    name: "ui:story controls sheet",
    run: () =>
      mustInclude("components/story/StoryControlsSheet.tsx", "Story controls", "ui"),
  },
  {
    name: "ui:owner menu in viewer",
    run: () =>
      mustInclude("components/WorkoutStoryViewer.tsx", "StoryControlsButton", "ui"),
  },
  {
    name: "ui:create-story privacy selector",
    run: () => mustInclude("app/create-story.tsx", "StoryPrivacySelector", "ui"),
  },
];

let failed = 0;
for (const check of checks) {
  try {
    check.run();
    console.log(`ok  ${check.name}`);
  } catch (error) {
    failed += 1;
    console.error(`fail  ${check.name}: ${error instanceof Error ? error.message : error}`);
  }
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log(`\n${checks.length} story-controls checks passed`);
}
