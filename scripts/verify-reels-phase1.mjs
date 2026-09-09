#!/usr/bin/env node
/**
 * Phase 1 Frennix Reels — architecture and copy guards.
 *
 * Usage:
 *   node scripts/verify-reels-phase1.mjs
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

function main() {
  console.log("verify-reels-phase1\n");
  let ok = true;

  const tabs = readSource("app/(tabs)/_layout.tsx");
  const reels = readSource("app/(tabs)/reels.tsx");
  const createPost = readSource("app/create-post.tsx");
  const viewer = readSource("components/ImmersiveVideoViewer.tsx");
  const playlistViewer = readSource("components/ImmersiveVideoPlaylistViewer.tsx");
  const overlayShell = readSource("components/ImmersiveVideoOverlayShell.tsx");
  const playlistState = readSource("lib/immersive-video-playlist-state.ts");
  const postsApi = readSource("packages/api/src/posts.ts");
  const migration = readSource("supabase/migrations/20260908140000_post_journey_category.sql");
  const types = readSource("packages/types/src/journey-category.ts");
  const postType = readSource("packages/types/src/index.ts");

  ok =
    pass(
      "Reels tab is registered in primary navigation",
      tabs.includes('name="reels"') &&
        tabs.includes('tabBarLabel: "Reels"') &&
        tabs.includes("Share Your Journey") &&
        fs.existsSync(path.join(ROOT, "app/(tabs)/reels.tsx"))
    ) && ok;

  ok =
    pass(
      "Reels reuses the existing immersive playlist viewer",
      reels.includes("openGallery") &&
        reels.includes("buildFeedVideoPlaylistFromPosts") &&
        reels.includes("useBuildImmersiveVideoContext") &&
        !reels.includes("new Video") &&
        !reels.includes("document.createElement(\"video\")")
    ) && ok;

  ok =
    pass(
      "Reels fetches dedicated Reels pages without using the home feed query",
      reels.includes('queryKey: ["reels", userId]') &&
        reels.includes("getReelsFeed") &&
        !reels.includes("getVideoFeed") &&
        !reels.includes('queryKey: ["feed"')
    ) && ok;

  ok =
    pass(
      "Reels empty state describes community fitness journeys",
      reels.includes("Reels are fitness journeys shared by the Frennix community") &&
        reels.includes("Share Your Journey")
    ) && ok;

  ok =
    pass(
      "Reels screen has one heading and no in-list Reels title",
      !reels.includes("ListHeaderComponent") && !reels.includes("screenLabel")
    ) && ok;

  ok =
    pass(
      "Create-post keeps the existing uploader and adds the journey prompt",
      createPost.includes("Your journey could be the reason someone else keeps going. Tell your story.") &&
        createPost.includes("JOURNEY_CATEGORIES") &&
        createPost.includes("intent") &&
        createPost.includes("shareWorkout")
    ) && ok;

  ok =
    pass(
      "Viewer shows a category label only when one exists",
      viewer.includes("getJourneyCategoryLabel") &&
        viewer.includes("journeyCategoryLabel") &&
        viewer.includes("{journeyCategoryLabel ?")
    ) && ok;

  ok =
    pass(
      "API adds a nullable journey_category without a new Reels table",
      postsApi.includes("journey_category?: JourneyCategory | null") &&
        postsApi.includes("getReelsFeed") &&
        postsApi.includes('postType: "video"') &&
        postsApi.includes("isReel: true") &&
        migration.includes("ADD COLUMN IF NOT EXISTS journey_category TEXT") &&
        migration.includes("journey_category IS NULL") &&
        !migration.toLowerCase().includes("create table") &&
        !migration.toLowerCase().includes("drop table")
    ) && ok;

  ok =
    pass(
      "Journey category catalog matches Phase 1 labels",
      types.includes("starting_over") &&
        types.includes("mental_wellness") &&
        types.includes("weight_loss") &&
        types.includes("Starting Over") &&
        types.includes("Mental Wellness") &&
        postType.includes("journey_category?: JourneyCategory | null")
    ) && ok;

  ok =
    pass(
      "Reels does not add dating copy or a second player",
      !reels.toLowerCase().includes("dating") &&
        !reels.toLowerCase().includes("soulmate") &&
        !reels.includes("<Heart") &&
        !createPost.toLowerCase().includes("therapy") &&
        !createPost.toLowerCase().includes("medical treatment")
    ) && ok;

  ok =
    pass(
      "Reels auto-opens the existing overlay on an intentional tab visit",
      reels.includes("openedThisVisitRef") &&
        reels.includes("openReelRef.current(firstReel)") &&
        reels.includes("openGallery") &&
        !reels.includes("ImmersiveVideoOverlayShell")
    ) && ok;

  ok =
    pass(
      "Tab bar is icon-only with a 48pt item minimum",
      tabs.includes("tabBarShowLabel: false") &&
        tabs.includes("minWidth: 48") &&
        tabs.includes("minHeight: 44") &&
        tabs.includes('tabBarAccessibilityLabel: "Feed"') &&
        tabs.includes('tabBarAccessibilityLabel: "Reels"') &&
        tabs.includes('tabBarAccessibilityLabel: "Discover"') &&
        tabs.includes('tabBarAccessibilityLabel: "Calendar"') &&
        tabs.includes('tabBarAccessibilityLabel: "Post"') &&
        tabs.includes('tabBarAccessibilityLabel: "Messages"') &&
        tabs.includes('tabBarAccessibilityLabel: "Profile"')
    ) && ok;

  ok =
    pass(
      "Like toggle keeps origin persistence behavior",
      postsApi.includes("if (error && !isUniqueConstraintError(error)) throw error;") &&
        postsApi.includes("formatSupabaseError") &&
        postsApi.includes("isUniqueConstraintError") &&
        postsApi.includes("./profile-utils")
    ) && ok;

  ok =
    pass(
      "Immersive Reels controls stay above swipe capture",
      viewer.includes("function RailAction(") &&
        viewer.includes('data-frennix-immersive-control') &&
        viewer.includes("hitSlop={CONTROL_HIT_SLOP}") &&
        playlistViewer.includes("isPlaylistChromeTarget") &&
        playlistViewer.includes("captured: false") &&
        playlistViewer.includes("if (!gesture.captured)")
    ) && ok;

  ok =
    pass(
      "Owner Reel delete uses the selected post id and closes the viewer",
      reels.includes("onDeleted: () => closeGallery(0)") &&
        postsApi.includes("deletePost storage cleanup") &&
        postsApi.includes('.eq("author_id", userId)')
    ) && ok;

  ok =
    pass(
      "Share sheet uses the shared root portal and does not close the Reel",
      readSource("components/SharePostSheet.tsx").includes("rootPortal") &&
        readSource("components/SharePostSheet.tsx").includes("OVERLAY_Z_INDEX.shareSheet") &&
        readSource("lib/useSharePost.tsx").includes("<SharePostSheet") &&
        !readSource("lib/useSharePost.tsx").includes("closeGallery") &&
        reels.includes("{shareSheet}") &&
        viewer.includes('label="Share"')
    ) && ok;

  ok =
    pass(
      "Share Your Journey uses Post Your Journey; regular Share Workout uses Post Workout",
      createPost.includes('"Post Your Journey"') &&
        createPost.includes('"Post Workout"') &&
        !createPost.includes('"Save Workout"') &&
        createPost.includes('? "Share post"') &&
        createPost.includes(': "Post Workout"') &&
        createPost.includes("isReelIntent") &&
        createPost.includes('await executeShare("reel")') &&
        readSource("components/WorkoutSavedSheet.tsx").includes('label: "Post to Feed"')
    ) && ok;

  ok =
    pass(
      "Caught-up copy is a dedicated non-video end state, never an overlay on an active Reel",
      playlistViewer.includes("caughtUpLabel") &&
        playlistViewer.includes("DEFAULT_CAUGHT_UP_LABEL = \"You're caught up on feed videos\"") &&
        playlistViewer.includes("showEndState") &&
        playlistViewer.includes("activeIndex >= entries.length") &&
        playlistViewer.includes("data-frennix-playlist-end-state") &&
        playlistViewer.includes("endStateSlide") &&
        !playlistViewer.includes("webFooterHost") &&
        overlayShell.includes("caughtUpLabel={playlist.caughtUpLabel}") &&
        playlistState.includes("caughtUpLabel?: string") &&
        reels.includes('caughtUpLabel: "You\'re caught up on Reels"') &&
        !reels.includes("You're caught up on feed videos") &&
        viewer.includes("metadataStack") &&
        viewer.includes("data-frennix-immersive-metadata-stack") &&
        viewer.includes("data-frennix-immersive-category") &&
        viewer.includes("data-frennix-immersive-caption")
    ) && ok;

  console.log("");
  console.log(ok ? "All checks passed." : "Some checks failed.");
  process.exit(ok ? 0 : 1);
}

main();
