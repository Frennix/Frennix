import type { FeedStory, FeedStoryLastWorkout, Post, Profile, StoryAudience } from "@frennix/types";
import { normalizePostWorkoutFields } from "@frennix/types";
import { getFollowing } from "./follows";
import { getStoryViewsForViewer } from "./story-engagement";
import { computeWorkoutStreakFromDates } from "./streaks";
import { getSupabase } from "./supabase";
import { computeStoryMilestones, normalizeWorkoutStoryMetrics } from "./workout-story-utils";

const WORKOUT_POST_TYPES = ["workout_update", "photo", "video"] as const;
const RECENT_WORKOUT_MS = 24 * 60 * 60 * 1000;

function toLastWorkout(
  post: Post,
  streak: number,
  workoutCount: number
): FeedStoryLastWorkout {
  const normalized = normalizePostWorkoutFields(post);
  const metrics = normalizeWorkoutStoryMetrics(
    (normalized as Post).workout_metrics ?? null
  );
  const milestoneFlags = (normalized as Post).story_milestones ?? [];

  return {
    post_id: normalized.id,
    post_type: normalized.post_type,
    workout_type: normalized.workout_type,
    workout_types: normalized.workout_types,
    media_urls: normalized.media_urls ?? [],
    thumbnail_url: normalized.thumbnail_url ?? null,
    content: normalized.content,
    created_at: normalized.created_at,
    metrics,
    milestones: computeStoryMilestones({
      streak,
      workoutCount,
      storyMilestoneFlags: milestoneFlags,
    }),
    story_audience: ((normalized as Post).story_audience ?? "public") as StoryAudience,
  };
}

function canViewerSeeStory(
  post: Post | null,
  authorId: string,
  viewerId: string,
  followingIds: Set<string>,
  mutualFriendIds: Set<string>
): boolean {
  if (authorId === viewerId) return true;
  if (!post) return true;
  const audience = post.story_audience ?? "public";
  if (audience === "private") return false;
  if (audience === "friends") return mutualFriendIds.has(authorId);
  if (audience === "followers") return followingIds.has(authorId);
  return true;
}

function buildStory(
  profile: Profile,
  viewerId: string,
  followingIds: Set<string>,
  workoutDates: string[],
  workoutCount: number,
  latestPost: Post | null,
  now: Date
): FeedStory {
  const streak = computeWorkoutStreakFromDates(workoutDates, now);
  const lastWorkout = latestPost ? toLastWorkout(latestPost, streak, workoutCount) : null;
  const hasRecentWorkout = lastWorkout
    ? now.getTime() - new Date(lastWorkout.created_at).getTime() <= RECENT_WORKOUT_MS
    : false;

  return {
    user_id: profile.id,
    profile,
    workout_streak: streak,
    workout_count: workoutCount,
    has_recent_workout: hasRecentWorkout,
    last_workout: lastWorkout,
    is_self: profile.id === viewerId,
    viewer_follows: profile.id === viewerId || followingIds.has(profile.id),
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

  const followingIds = new Set(following.map((profile) => profile.id));
  const now = new Date();

  const { data: followersOfViewer } = await getSupabase()
    .from("follows")
    .select("follower_id")
    .eq("following_id", viewerId);

  const mutualFriendIds = new Set<string>();
  for (const row of followersOfViewer ?? []) {
    const followerId = row.follower_id as string;
    if (followingIds.has(followerId)) mutualFriendIds.add(followerId);
  }

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
  const countByUser = new Map<string, number>();
  const latestByUser = new Map<string, Post>();

  for (const row of workoutPosts ?? []) {
    const authorId = row.author_id as string;
    const dates = datesByUser.get(authorId) ?? [];
    dates.push(row.created_at as string);
    datesByUser.set(authorId, dates);
    countByUser.set(authorId, (countByUser.get(authorId) ?? 0) + 1);
  }

  for (const post of (latestPosts ?? []) as Post[]) {
    if (!latestByUser.has(post.author_id)) {
      latestByUser.set(post.author_id, normalizePostWorkoutFields(post));
    }
  }

  const stories = profiles
    .map((profile) =>
      buildStory(
        profile,
        viewerId,
        followingIds,
        datesByUser.get(profile.id) ?? [],
        countByUser.get(profile.id) ?? 0,
        latestByUser.get(profile.id) ?? null,
        now
      )
    )
    .filter((story) =>
      canViewerSeeStory(
        latestByUser.get(story.user_id) ?? null,
        story.user_id,
        viewerId,
        followingIds,
        mutualFriendIds
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

  const views = await getStoryViewsForViewer(
    viewerId,
    stories.map((story) => story.user_id)
  );
  const viewedPostByUser = new Map(
    views.map((view) => [view.story_user_id, view.last_viewed_post_id])
  );

  return stories.map((story) => {
    const postId = story.last_workout?.post_id ?? null;
    const viewedPostId = viewedPostByUser.get(story.user_id) ?? null;
    return {
      ...story,
      viewed: Boolean(postId && viewedPostId === postId),
    };
  });
}
