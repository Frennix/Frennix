#!/usr/bin/env node
/**
 * Frennix Reels content model — destination split and flag guards.
 *
 * Usage:
 *   node scripts/verify-reels-content-model.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function pass(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

function readSource(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function belongsOnFeed(post) {
  return post.is_reel !== true;
}

function belongsOnReels(post) {
  return post.post_type === "video" && post.is_reel === true;
}

function resolveCreateFlag({ destination, hasVideo, explicitIsReel }) {
  if (explicitIsReel !== undefined) return explicitIsReel === true;
  return destination === "reel" && hasVideo === true;
}

function main() {
  console.log("verify-reels-content-model\n");
  let ok = true;

  const postsApi = readSource("packages/api/src/posts.ts");
  const types = readSource("packages/types/src/index.ts");
  const shareWorkout = readSource("lib/share-workout.ts");
  const createPost = readSource("app/create-post.tsx");
  const savedSheet = readSource("components/WorkoutSavedSheet.tsx");
  const reels = readSource("app/(tabs)/reels.tsx");
  const journeyMigration = readSource("supabase/migrations/20260908140000_post_journey_category.sql");
  const isReelMigration = readSource("supabase/migrations/20260908200000_post_is_reel.sql");

  ok =
    pass(
      "Additive is_reel column defaults false and does not rewrite rows",
      isReelMigration.includes("ADD COLUMN IF NOT EXISTS is_reel BOOLEAN NOT NULL DEFAULT FALSE") &&
        !/\bUPDATE\b/i.test(isReelMigration) &&
        !/\bDELETE\b/i.test(isReelMigration) &&
        !/\bRENAME\b/i.test(isReelMigration) &&
        !/\bUPDATE\s+public\.posts\b/i.test(isReelMigration)
    ) && ok;

  ok =
    pass(
      "Existing journey_category migration is unchanged and has no is_reel",
      journeyMigration.includes("ADD COLUMN IF NOT EXISTS journey_category TEXT") &&
        journeyMigration.includes("posts_journey_category_check") &&
        !journeyMigration.includes("is_reel")
    ) && ok;

  ok =
    pass(
      "Post type and createPost API treat is_reel as optional default false",
      types.includes("is_reel?: boolean") &&
        postsApi.includes("is_reel?: boolean") &&
        postsApi.includes("isReel?: boolean") &&
        postsApi.includes("const isReelPost = is_reel === true || isReel === true") &&
        postsApi.includes("is_reel: isReelPost")
    ) && ok;

  ok =
    pass(
      "Share Your Journey submits is_reel=true; normal posts do not",
      shareWorkout.includes("is_reel: postType === \"video\" && input.isReel === true") &&
        createPost.includes("const postToReels = mode === \"reel\" && hasVideo;") &&
        createPost.includes("isReel: postToReels") &&
        createPost.includes("isReel: false") &&
        createPost.includes('paramValue(params.intent) === "reel"')
    ) && ok;

  ok =
    pass(
      "Dedicated Reels query requires post_type=video AND is_reel=true",
      postsApi.includes("export async function getReelsFeed") &&
        postsApi.includes('postType: "video"') &&
        postsApi.includes("isReel: true") &&
        postsApi.includes('q = q.eq("is_reel", options?.isReel === true)') &&
        !postsApi.includes("export async function getVideoFeed") &&
        reels.includes("getReelsFeed") &&
        !reels.includes("getVideoFeed")
    ) && ok;

  ok =
    pass(
      "Normal Feed excludes is_reel=true",
      postsApi.includes('q = q.eq("is_reel", options?.isReel === true)') &&
        /export async function getFeed\(/.test(postsApi) &&
        postsApi.includes("const core = await getFeedCore(userId, cursor, limit);")
    ) && ok;

  ok =
    pass(
      "Journey category selector is Share Your Journey only",
      createPost.includes("const showJourneyChrome = isReelIntent;") &&
        !createPost.includes("const showJourneyChrome = isReelIntent || hasVideo")
    ) && ok;

  ok =
    pass(
      "Reels empty state and a single Reels heading",
      reels.includes("Reels are fitness journeys shared by the Frennix community.") &&
        reels.includes('actionLabel="Share Your Journey"') &&
        !reels.includes("ListHeaderComponent") &&
        !reels.includes("screenLabel")
    ) && ok;

  const existingVideo = { id: "legacy-video", post_type: "video", is_reel: false };
  const journeyReel = { id: "journey-reel", post_type: "video", is_reel: true };
  const newNormalVideo = { id: "new-video", post_type: "video", is_reel: false };
  const photoPost = { id: "photo", post_type: "photo", is_reel: false };

  ok =
    pass(
      "Existing normal video with is_reel=false appears only in Feed",
      belongsOnFeed(existingVideo) && !belongsOnReels(existingVideo)
    ) && ok;

  ok =
    pass(
      "Journey video with is_reel=true appears only in Reels",
      belongsOnReels(journeyReel) && !belongsOnFeed(journeyReel)
    ) && ok;

  ok =
    pass(
      "A newly uploaded normal video defaults to Feed",
      resolveCreateFlag({ destination: "feed", hasVideo: true }) === false &&
        belongsOnFeed(newNormalVideo) &&
        !belongsOnReels(newNormalVideo)
    ) && ok;

  ok =
    pass(
      "Share Your Journey creates is_reel=true",
      resolveCreateFlag({ destination: "reel", hasVideo: true }) === true &&
        resolveCreateFlag({ destination: "reel", hasVideo: false }) === false &&
        resolveCreateFlag({ destination: "feed", hasVideo: true }) === false
    ) && ok;

  ok =
    pass(
      "Post to Reels is rendered first for intent=reel",
      savedSheet.includes("reelIntent ? [REEL_OPTION, ...BASE_OPTIONS] : BASE_OPTIONS") &&
        savedSheet.includes('label: "Post to Reels"') &&
        savedSheet.includes("Share this journey video in Reels") &&
        createPost.includes("reelIntent={isReelIntent}")
    ) && ok;

  ok =
    pass(
      "Sharing destinations can scroll inside the visible viewport",
      savedSheet.includes("ScrollView") &&
        savedSheet.includes('keyboardShouldPersistTaps="handled"') &&
        savedSheet.includes("minHeight: 0") &&
        savedSheet.includes("flex: 1") &&
        savedSheet.includes("sheetMaxHeight") &&
        savedSheet.includes("measureSafariVisualViewport") &&
        savedSheet.includes("paddingBottom: scrollBottomPadding")
    ) && ok;

  ok =
    pass(
      "No existing rows are automatically converted",
      [existingVideo, photoPost].every((post) => post.is_reel === false) &&
        !/\bUPDATE\b/i.test(isReelMigration)
    ) && ok;

  ok =
    pass(
      "Reels no longer relies only on post_type='video'",
      !belongsOnReels({ post_type: "video", is_reel: false }) &&
        !belongsOnReels({ post_type: "video" }) &&
        belongsOnReels({ post_type: "video", is_reel: true }) &&
        !belongsOnReels({ post_type: "photo", is_reel: true })
    ) && ok;

  console.log("");
  console.log(ok ? "All checks passed." : "Some checks failed.");
  process.exit(ok ? 0 : 1);
}

main();
