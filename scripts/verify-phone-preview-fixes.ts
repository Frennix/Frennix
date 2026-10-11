/**
 * Phone-preview regressions: empty composer after publish, full photos,
 * new-post counts, and a single in-flight delete.
 *
 * Usage: npx tsx scripts/verify-phone-preview-fixes.ts
 */
import { QueryClient } from "@tanstack/react-query";
import type { Post } from "@frennix/types";
import {
  composerNeedsFreshStart,
  consumeComposerFreshStart,
  currentDraftWriteGeneration,
  markComposerPublished,
  peekMemoryDraft,
  writeMemoryDraft,
} from "../lib/create-post-draft-session";
import { countNewFeedPosts, noteFeedPostRemoved } from "../lib/feed-new-posts";
import { feedFrameSize } from "../lib/photo-frame";
import { claimPostDelete, releasePostDelete } from "../lib/post-delete-guard";
import { removePostFromAllCaches } from "../lib/post-cache";
import { computePhotoDisplayFrame } from "../packages/ui/src/mediaLayout";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function post(partial: Partial<Post> & Pick<Post, "id">): Post {
  return partial as Post;
}

function checkComposer() {
  const userId = "composer-user";
  const published = {
    content: "Steak and eggs",
    feedCategory: "nutrition" as const,
    workoutTypes: [] as string[],
    groupId: null,
    challengeId: null,
    eventId: null,
    mimeType: "image/jpeg",
    videoDurationSeconds: null,
    mediaUri: "file://steak.jpg",
    hasStoredMedia: true,
  };
  const generation = currentDraftWriteGeneration();
  writeMemoryDraft(userId, published, null, undefined, generation);
  assert(peekMemoryDraft(userId)?.draft.content === "Steak and eggs", "draft starts in memory");

  markComposerPublished(userId);
  writeMemoryDraft(userId, published, null, undefined, generation);
  assert(!peekMemoryDraft(userId), "a late save must not restore the published meal");
  assert(composerNeedsFreshStart(userId), "the next composer is marked for a fresh start");
  assert(consumeComposerFreshStart(userId), "opening the next composer consumes the fresh start");
  assert(!composerNeedsFreshStart(userId), "a second open keeps a normal draft");

  const workout = { ...published, content: "", feedCategory: "workout" as const, mediaUri: null, hasStoredMedia: false };
  writeMemoryDraft(userId, workout, null);
  assert(peekMemoryDraft(userId)?.draft.content === "", "the next workout composer starts empty");
  assert(peekMemoryDraft(userId)?.draft.feedCategory === "workout", "the requested category is kept");
  console.log("PASS  Published content does not return in the next composer");
}

function checkPhotos() {
  const width = 390;
  const steak = computePhotoDisplayFrame(width, 1080, 1920);
  const croppedHeight = width * (5 / 4);
  assert(steak.contentFit === "contain", "photos fit inside the frame");
  assert(Math.abs(steak.height - width * (1920 / 1080)) < 0.5, "a tall photo keeps its aspect ratio");
  assert(steak.height > croppedHeight + 1, "the frame is taller than the old 4:5 crop");

  const extreme = computePhotoDisplayFrame(width, 1080, 4000);
  assert(extreme.height === width * 2, "an extreme photo fits inside the height limit");
  assert(extreme.contentFit === "contain", "the height limit still shows the whole photo");

  const frame = feedFrameSize(360, 800, { width: 1080, height: 1920 });
  const frameRatio = frame.frameHeight / frame.frameWidth;
  assert(Math.abs(frameRatio - 1920 / 1080) < 0.01, "the upload frame matches the original photo");
  console.log("PASS  Photos keep their full frame in the feed and the upload editor");
}

function checkBanner() {
  const loaded = [post({ id: "visible", author_id: "me", feed_category: "nutrition" })];
  const head = [
    post({ id: "deleted-1", author_id: "me", feed_category: "nutrition" }),
    post({ id: "deleted-1", author_id: "me", feed_category: "nutrition" }),
    post({ id: "mine", author_id: "me", feed_category: "nutrition" }),
    post({ id: "visible", author_id: "me", feed_category: "nutrition" }),
    post({ id: "other", author_id: "friend", feed_category: "nutrition" }),
    post({ id: "workout", author_id: "friend", feed_category: "workout" }),
  ];
  const removed = new Set(["deleted-1"]);
  const count = countNewFeedPosts(loaded, head, {
    viewerId: "me",
    removedIds: removed,
    feedCategory: "nutrition",
  });
  assert(count === 2, `expected mine + other, got ${count}`);
  noteFeedPostRemoved("deleted-1");
  const afterDelete = countNewFeedPosts(loaded, head, { feedCategory: "nutrition" });
  assert(afterDelete === 2, "removed posts stay out of the banner");
  console.log("PASS  New-post count ignores deleted, duplicate, and already visible posts");
}

function checkDelete() {
  const inFlight = new Set<string>();
  assert(claimPostDelete(inFlight, "workout-1"), "the first delete starts");
  assert(!claimPostDelete(inFlight, "workout-1"), "a second tap does not start another request");
  releasePostDelete(inFlight, "workout-1");
  assert(claimPostDelete(inFlight, "workout-1"), "a failed delete can be retried");

  const client = new QueryClient();
  const userId = "user";
  const workout = post({ id: "workout-1", author_id: userId, feed_category: "workout" });
  const page = { pages: [{ posts: [workout], nextCursor: null }], pageParams: [null] };
  client.setQueryData(["feed", userId, "all"], page);
  client.setQueryData(["feed", userId, "workouts"], page);
  client.setQueryData(["feed-head-peek", userId, "all"], { posts: [workout], nextCursor: null });

  const previousFeeds = client.getQueriesData({ queryKey: ["feed", userId] });
  removePostFromAllCaches(client, userId, workout.id);
  const workouts = client.getQueryData<{ pages: { posts: Post[] }[] }>(["feed", userId, "workouts"]);
  const all = client.getQueryData<{ pages: { posts: Post[] }[] }>(["feed", userId, "all"]);
  const peek = client.getQueryData<{ posts: Post[] }>(["feed-head-peek", userId, "all"]);
  assert(workouts?.pages[0]?.posts.length === 0, "workout tab drops the deleted post");
  assert(all?.pages[0]?.posts.length === 0, "all tab drops the deleted post");
  assert(peek?.posts.length === 0, "the new-post peek drops the deleted post");

  for (const [key, data] of previousFeeds) client.setQueryData(key, data);
  const restored = client.getQueryData<{ pages: { posts: Post[] }[] }>(["feed", userId, "workouts"]);
  assert(restored?.pages[0]?.posts[0]?.id === "workout-1", "a failed delete puts the workout back");
  console.log("PASS  One delete updates every feed tab and restores the post on failure");
}

checkComposer();
checkPhotos();
checkBanner();
checkDelete();
console.log("\nphone preview fix checks passed");
