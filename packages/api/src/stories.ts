import type { FeedStory, FeedStoryLastWorkout, Post, Profile } from "@frennix/types";
import { getFollowing } from "./follows";
import { computeWorkoutStreakFromDates } from "./streaks";
import { getSupabase } from "./supabase";

const WORKOUT_POST_TYPES = ["workout_update", "photo", "video"] as const;
const RECENT_WORKOUT_MS = 24 * 60 * 60 * 1000;

function toLastWorkout(post: Post): FeedStoryLastWorkout {
  return {
    post_id: post.id,
    post_type: post.post_type,
    workout_type: post.workout_type ?? null,
    media_urls: post.media_urls ?? [],
    thumbnail_url: post.thumbnail_url ?? null,
    content: post.content,
    created_at: post.created_at,
  };
}

function buildStory(
  profile: Profile,
  viewerId: string,
  workoutDates: string[],
  latestPost: Post | null,
  now: Date
): FeedStory {
  const lastWorkout = latestPost ? toLastWorkout(latestPost) : null;
  const hasRecentWorkout = lastWorkout
    ? now.getTime() - new Date(lastWorkout.created_at).getTime() <= RECENT_WORKOUT_MS
    : false;

  return {
    user_id: profile.id,
    profile,
    workout_streak: computeWorkoutStreakFromDates(workoutDates, now),
    has_recent_workout: hasRecentWorkout,
    last_workout: lastWorkout,
    is_self: profile.id === viewerId,
  };
}

export async function getFeedStories(viewerId: string): Promise<FeedStory[]> {
  const [selfProfile, following] = await Promise.all([
    getSupabase().from("profiles_reader").select("*").eq("id", viewerId).single(),
    getFollowing(viewerId),
  ]);

  if (selfProfile.error) throw selfProfile.error;

  const profiles: Profile[] = [selfProfile.data as Profile, ...following];
  const userIds = profiles.map((profile) => profile.id);
  if (!userIds.length) return [];

  const now = new Date();

  const [{ data: workoutPosts }, { data: latestPosts }] = await Promise.all([
    getSupabase()
      .from("posts")
      .select("author_id, created_at")
      .in("author_id", userIds)
      .in("post_type", [...WORKOUT_POST_TYPES]),
    getSupabase()
      .from("posts")
      .select("*")
      .in("author_id", userIds)
      .in("post_type", [...WORKOUT_POST_TYPES])
      .order("created_at", { ascending: false }),
  ]);

  if (workoutPosts.error) throw workoutPosts.error;
  if (latestPosts.error) throw latestPosts.error;

  const datesByUser = new Map<string, string[]>();
  const latestByUser = new Map<string, Post>();

  for (const row of workoutPosts ?? []) {
    const authorId = row.author_id as string;
    const dates = datesByUser.get(authorId) ?? [];
    dates.push(row.created_at as string);
    datesByUser.set(authorId, dates);
  }

  for (const post of (latestPosts ?? []) as Post[]) {
    if (!latestByUser.has(post.author_id)) {
      latestByUser.set(post.author_id, post);
    }
  }

  const stories = profiles.map((profile) =>
    buildStory(
      profile,
      viewerId,
      datesByUser.get(profile.id) ?? [],
      latestByUser.get(profile.id) ?? null,
      now
    )
  );

  stories.sort((a, b) => {
    if (a.is_self) return -1;
    if (b.is_self) return 1;
    if (a.has_recent_workout !== b.has_recent_workout) {
      return a.has_recent_workout ? -1 : 1;
    }
    const aTime = a.last_workout ? new Date(a.last_workout.created_at).getTime() : 0;
    const bTime = b.last_workout ? new Date(b.last_workout.created_at).getTime() : 0;
    return bTime - aTime;
  });

  return stories;
}
