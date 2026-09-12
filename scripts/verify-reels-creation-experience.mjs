#!/usr/bin/env node
/**
 * Frennix Reels creation experience — cache, form, direct publish, and duration guards.
 *
 * Usage:
 *   node scripts/verify-reels-creation-experience.mjs
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

function indexOrder(source, snippets) {
  let last = -1;
  for (const snippet of snippets) {
    const index = source.indexOf(snippet);
    if (index === -1 || index < last) return false;
    last = index;
  }
  return true;
}

function belongsOnFeed(post) {
  return post.is_reel !== true;
}

function belongsOnReels(post) {
  return post.post_type === "video" && post.is_reel === true;
}

function main() {
  console.log("verify-reels-creation-experience\n");
  let ok = true;

  const createPost = readSource("app/create-post.tsx");
  const shareWorkout = readSource("lib/share-workout.ts");
  const reelsCache = readSource("lib/reels-cache.ts");
  const reels = readSource("app/(tabs)/reels.tsx");
  const mediaDuration = readSource("lib/media-duration.ts");
  const uploadUtils = readSource("packages/api/src/upload-utils.ts");
  const editPost = readSource("app/edit-post/[id].tsx");
  const createStory = readSource("app/create-story.tsx");
  const feedCache = readSource("lib/feed-cache.ts");
  const feedIndex = readSource("app/(tabs)/index.tsx");
  const postsApi = readSource("packages/api/src/posts.ts");
  const savedSheet = readSource("components/WorkoutSavedSheet.tsx");

  const reelBlock = shareWorkout.slice(
    shareWorkout.indexOf("if (shouldReel)"),
    shareWorkout.indexOf("} else if (shouldFeed)")
  );

  ok =
    pass(
      "1. New Reel appears in Reels without manual refresh",
      shareWorkout.includes("prependReelToReelsQuery(queryClient, input.userId, confirmedReel)") &&
        shareWorkout.includes('invalidateQueries({ queryKey: ["reels", input.userId] })') &&
        createPost.includes("if (mode === \"reel\")") &&
        createPost.includes('switchTab("/(tabs)/reels")') &&
        reels.includes("consumePendingActiveReelId") &&
        reels.includes("pendingReel")
    ) && ok;

  ok =
    pass(
      "2. Reels cache update deduplicates by ID",
      reelsCache.includes("export function prependReelToReelsPages") &&
        reelsCache.includes("page.posts.filter((candidate) => candidate.id !== reel.id)") &&
        reelsCache.includes("posts: [reel, ...firstPage.posts]") &&
        reelsCache.includes('queryClient.setQueryData<InfiniteData<FeedPage>>(["reels", userId]')
    ) && ok;

  ok =
    pass(
      "3. New Reel is not inserted into Feed cache",
      !reelsCache.includes('["feed"') &&
        !reelBlock.includes('queryKey: ["feed"') &&
        shareWorkout.includes("stripReelsFromFeedQuery(queryClient, input.userId)") &&
        feedCache.includes("stripReelsFromFeedQuery")
    ) && ok;

  ok =
    pass(
      "4. intent=reel directly creates one is_reel=true video",
      createPost.includes('await executeShare("reel")') &&
        (reelBlock.match(/createPost\(/g) || []).length === 1 &&
        reelBlock.includes("is_reel: true") &&
        reelBlock.includes('postType !== "video"') &&
        !reelBlock.includes("publishStory")
    ) && ok;

  ok =
    pass(
      "5. intent=reel bypasses the destination panel",
      createPost.includes("if (isReelIntent)") &&
        createPost.includes('await executeShare("reel")') &&
        createPost.includes("visible={savedSheetVisible && !isReelIntent}") &&
        createPost.includes("setSavedSheetVisible(true)") &&
        savedSheet.includes('label: "Post to Feed"') &&
        savedSheet.includes('label: "Share to Story"') &&
        savedSheet.includes('label: "Share to Both"')
    ) && ok;

  ok =
    pass(
      "6. Reel button says Post Your Journey",
      createPost.includes('"Post Your Journey"') &&
        createPost.includes('"Post Workout"') &&
        !createPost.includes('"Save Workout"')
    ) && ok;

  ok =
    pass(
      "7. Reel prompt and Related activity wording are correct",
      createPost.includes('label="What part of your journey are you sharing?"') &&
        createPost.includes('label="What did you accomplish?"') &&
        createPost.includes(">Related activity</Text>") &&
        createPost.includes("Optional — add an activity connected to your journey.") &&
        createPost.includes(">Workout types</Text>")
    ) && ok;

  ok =
    pass(
      "8. Workout details and Story privacy are absent from intent=reel",
      createPost.includes("{!isContextPost && !isReelIntent ? (") &&
        createPost.includes(">Workout details</Text>") &&
        createPost.includes(">Story privacy</Text>") &&
        indexOrder(createPost, [
          "What part of your journey are you sharing?",
          "Videos up to 90 seconds.",
          "Related activity",
          "Post Your Journey",
        ])
    ) && ok;

  ok =
    pass(
      "9. Those sections remain present in normal Post Workout",
      createPost.includes('label="Duration (min)"') &&
        createPost.includes('label="Distance (km)"') &&
        createPost.includes('label="Calories"') &&
        createPost.includes('label="Gym"') &&
        createPost.includes('label="Location"') &&
        createPost.includes(">Story privacy</Text>") &&
        createPost.includes(">Workout types</Text>") &&
        createPost.includes('"Post Workout"')
    ) && ok;

  ok =
    pass(
      "10. Reel limit is 90 seconds across every Reel entry path",
      mediaDuration.includes("export const REEL_MAX_SECONDS = 90") &&
        createPost.includes("isReelIntent ? REEL_MAX_SECONDS : VIDEO_MAX_SECONDS") &&
        createPost.includes("videoMaxDuration: videoMaxSeconds") &&
        shareWorkout.includes("isVideoTooLong(item.durationSeconds ?? null, REEL_MAX_SECONDS)") &&
        editPost.includes("videoMaxDuration: 60") &&
        createStory.includes("videoMaxDuration: 60") &&
        mediaDuration.includes("export const VIDEO_MAX_SECONDS = 60")
    ) && ok;

  ok =
    pass(
      "11. Videos over 90 seconds are rejected before upload",
      shareWorkout.includes("throw new Error(REEL_TOO_LONG_MESSAGE)") &&
        shareWorkout.indexOf("REEL_TOO_LONG_MESSAGE") <
          shareWorkout.indexOf("uploadFeedMediaAssets(input.userId, input.media)") &&
        createPost.includes("isVideoTooLong(durationSeconds, videoMaxSeconds)") &&
        mediaDuration.includes(
          "Video is too long. Please choose a video that is 90 seconds or less."
        ) &&
        createPost.includes('"Videos up to 90 seconds."')
    ) && ok;

  const existingVideo = { id: "legacy-video", post_type: "video", is_reel: false };
  const journeyReel = { id: "journey-reel", post_type: "video", is_reel: true };

  ok =
    pass(
      "12. Existing Feed/Reels separation guards still pass",
      belongsOnFeed(existingVideo) &&
        !belongsOnReels(existingVideo) &&
        belongsOnReels(journeyReel) &&
        !belongsOnFeed(journeyReel) &&
        postsApi.includes('q = q.eq("is_reel", options?.isReel === true)') &&
        feedIndex.includes("excludeReelPosts") &&
        shareWorkout.includes("is_reel: false") &&
        shareWorkout.includes("is_reel: true")
    ) && ok;

  const fileSizeOk =
    uploadUtils.includes("export const VIDEO_UPLOAD_MAX_BYTES = 50 * 1024 * 1024") &&
    uploadUtils.includes("validateMediaUploadSize") &&
    uploadUtils.includes("Maximum upload size is ${maxMb} MB");

  ok =
    pass(
      "Existing video file-size limit remains 50 MB",
      fileSizeOk,
      "VIDEO_UPLOAD_MAX_BYTES in packages/api/src/upload-utils.ts"
    ) && ok;

  console.log("");
  console.log(ok ? "All checks passed." : "Some checks failed.");
  process.exit(ok ? 0 : 1);
}

main();
