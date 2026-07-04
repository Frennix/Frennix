/**
 * Verify dedicated story tables on remote Supabase and story read/write paths.
 * Run: npx tsx scripts/verify-remote-story-tables.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1).replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

type Check = { id: string; ok: boolean; detail: string };

async function main() {
  loadEnv();
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars in .env");

  const supabase = createClient(url, key);
  const checks: Check[] = [];

  const tables = [
    "stories",
    "story_slides",
    "story_views",
    "story_reactions",
    "story_item_views",
    "story_item_reactions",
  ];

  for (const table of tables) {
    const { error } = await supabase.from(table).select("*").limit(1);
    const missing = error?.message?.toLowerCase().includes("does not exist");
    checks.push({
      id: `table:${table}`,
      ok: !missing,
      detail: missing ? error?.message ?? "missing" : "reachable via Supabase API",
    });
  }

  const { data: stories, error: storiesError } = await supabase
    .from("stories")
    .select("id, user_id, expires_at")
    .gt("expires_at", new Date().toISOString())
    .limit(5);

  checks.push({
    id: "query:active_stories",
    ok: !storiesError,
    detail: storiesError
      ? storiesError.message
      : `active story query ok (${stories?.length ?? 0} rows visible to anon)`,
  });

  if (stories?.length) {
    const storyIds = stories.map((row) => row.id as string);
    const { error: slidesError } = await supabase
      .from("story_slides")
      .select("id, story_id")
      .in("story_id", storyIds)
      .limit(5);

    checks.push({
      id: "query:story_slides_join",
      ok: !slidesError,
      detail: slidesError ? slidesError.message : "story_slides join query ok",
    });
  } else {
    checks.push({
      id: "query:story_slides_join",
      ok: true,
      detail: "no active stories yet; table query path verified separately",
    });
  }

  const publishSrc = readFileSync(join(ROOT, "packages/api/src/story-publish.ts"), "utf8");
  const storiesSrc = readFileSync(join(ROOT, "packages/api/src/stories.ts"), "utf8");
  const shareSrc = readFileSync(join(ROOT, "lib/share-workout.ts"), "utf8");
  const viewerSrc = readFileSync(join(ROOT, "components/WorkoutStoryViewer.tsx"), "utf8");

  checks.push({
    id: "code:publishStory_writes_stories",
    ok: publishSrc.includes('.from("stories")') && publishSrc.includes('.from("story_slides")'),
    detail: "publishStory inserts into stories + story_slides",
  });
  checks.push({
    id: "code:publishStory_not_posts",
    ok: !publishSrc.includes('.from("posts").insert'),
    detail: "publishStory does not insert into posts",
  });
  checks.push({
    id: "code:getFeedStories_reads_stories",
    ok: storiesSrc.includes('.from("stories")') && storiesSrc.includes("active_stories"),
    detail: "getFeedStories reads dedicated stories table",
  });
  checks.push({
    id: "code:story_only_skips_createPost",
    ok: shareSrc.includes('post_id: null') && shareSrc.includes("uploadStoryMedia"),
    detail: "story-only share path skips feed post creation",
  });
  checks.push({
    id: "code:viewer_no_post_fallback",
    ok: !viewerSrc.includes("buildStorySlides"),
    detail: "viewer does not fall back to post-derived slides",
  });

  console.log("\nRemote story system verification\n");
  let failed = 0;
  for (const check of checks) {
    const icon = check.ok ? "✅" : "❌";
    if (!check.ok) failed += 1;
    console.log(`${icon} ${check.id} — ${check.detail}`);
  }
  console.log(`\n${checks.length - failed}/${checks.length} PASS\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
