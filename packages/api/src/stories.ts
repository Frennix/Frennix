import type { FeedStory, FrennixStory, Profile, StorySlide } from "@frennix/types";
import { getFollowing } from "./follows";
import { normalizeProfile } from "./profile-normalize";
import { computeWorkoutStreakFromDates } from "./streaks";
import { getSupabase } from "./supabase";
import {
  canViewerSeeStoryPrivacy,
  getConnectedProfiles,
  getStoryPrivacyContext,
  hydrateDedicatedStories,
} from "./story-privacy";

const WORKOUT_POST_TYPES = ["workout_update", "photo", "video"] as const;

function groupSlidesByStory(slides: StorySlide[]): Map<string, StorySlide[]> {
  const map = new Map<string, StorySlide[]>();
  for (const slide of slides) {
    const list = map.get(slide.story_id) ?? [];
    list.push(slide);
    map.set(slide.story_id, list);
  }
  for (const [storyId, list] of map) {
    map.set(
      storyId,
      [...list].sort((a, b) => a.sort_order - b.sort_order)
    );
  }
  return map;
}

async function fetchActiveStoriesForUsers(userIds: string[]): Promise<FrennixStory[]> {
  if (!userIds.length) return [];

  const now = new Date().toISOString();

  const { data: storyRows, error } = await getSupabase()
    .from("stories")
    .select("*")
    .in("user_id", userIds)
    .gt("expires_at", now)
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!storyRows?.length) return [];

  const storyIds = storyRows.map((row) => row.id as string);

  const { data: slideRows, error: slidesError } = await getSupabase()
    .from("story_slides")
    .select("*")
    .in("story_id", storyIds)
    .order("sort_order", { ascending: true });

  if (slidesError) throw slidesError;

  const slidesByStory = groupSlidesByStory((slideRows ?? []) as StorySlide[]);
  return hydrateDedicatedStories(storyRows as Record<string, unknown>[], slidesByStory);
}

async function getStoryViewStatus(
  viewerId: string,
  storiesByUser: Map<string, FrennixStory[]>
): Promise<Map<string, boolean>> {
  const allStoryIds = [...storiesByUser.values()].flat().map((story) => story.id);
  if (!allStoryIds.length) return new Map();

  const { data, error } = await getSupabase()
    .from("story_item_views")
    .select("story_id, last_viewed_slide_id")
    .eq("viewer_id", viewerId)
    .in("story_id", allStoryIds);

  if (error) throw error;

  const viewedStories = new Set((data ?? []).map((row) => row.story_id as string));
  const result = new Map<string, boolean>();

  for (const [userId, stories] of storiesByUser) {
    if (!stories.length) {
      result.set(userId, true);
      continue;
    }
    const allViewed = stories.every((story) => viewedStories.has(story.id));
    result.set(userId, allViewed);
  }

  return result;
}

export async function getFeedStories(viewerId: string): Promise<FeedStory[]> {
  const [selfProfile, following, privacyContext] = await Promise.all([
    getSupabase().from("profiles_reader").select("*").eq("id", viewerId).single(),
    getFollowing(viewerId),
    getStoryPrivacyContext(viewerId),
  ]);

  if (selfProfile.error) throw selfProfile.error;

  const self = normalizeProfile(selfProfile.data as Profile);
  if (!self) return [];

  const followingIds = new Set(following.map((profile) => profile.id));
  const connectedProfiles = await getConnectedProfiles(viewerId, followingIds);

  const profiles: Profile[] = [
    self,
    ...following.map((row) => normalizeProfile(row)).filter((row): row is Profile => Boolean(row)),
    ...connectedProfiles,
  ];
  const userIds = [...new Set(profiles.map((profile) => profile.id))];
  if (!userIds.length) return [];

  const now = new Date();
  const { followingIds: viewerFollowingIds, mutualFriendIds, connectedIds } = privacyContext;

  const [{ data: workoutPosts }, activeStories] = await Promise.all([
    getSupabase()
      .from("posts")
      .select("author_id, created_at")
      .in("author_id", userIds)
      .in("post_type", [...WORKOUT_POST_TYPES]),
    fetchActiveStoriesForUsers(userIds),
  ]);

  if (workoutPosts.error) throw workoutPosts.error;

  const datesByUser = new Map<string, string[]>();
  const countByUser = new Map<string, number>();

  for (const row of workoutPosts ?? []) {
    const authorId = row.author_id as string;
    const dates = datesByUser.get(authorId) ?? [];
    dates.push(row.created_at as string);
    datesByUser.set(authorId, dates);
    countByUser.set(authorId, (countByUser.get(authorId) ?? 0) + 1);
  }

  const storiesByUser = new Map<string, FrennixStory[]>();
  for (const story of activeStories) {
    if (
      !canViewerSeeStoryPrivacy(story.privacy, story.user_id, viewerId, {
        followingIds: viewerFollowingIds,
        mutualFriendIds,
        connectedIds,
      })
    ) {
      continue;
    }
    const list = storiesByUser.get(story.user_id) ?? [];
    list.push(story);
    storiesByUser.set(story.user_id, list);
  }

  const viewedByUser = await getStoryViewStatus(viewerId, storiesByUser);

  const feedStories: FeedStory[] = profiles.map((profile) => {
    const userStories = storiesByUser.get(profile.id) ?? [];
    const streak = computeWorkoutStreakFromDates(datesByUser.get(profile.id) ?? [], now);
    const hasActiveStory = userStories.length > 0;

    return {
      user_id: profile.id,
      profile,
      workout_streak: streak,
      workout_count: countByUser.get(profile.id) ?? 0,
      has_recent_workout: hasActiveStory,
      active_stories: userStories,
      last_workout: null,
      is_self: profile.id === viewerId,
      viewer_follows: profile.id === viewerId || viewerFollowingIds.has(profile.id),
      viewed: viewedByUser.get(profile.id) ?? true,
    };
  });

  feedStories.sort((a, b) => {
    if (a.is_self) return -1;
    if (b.is_self) return 1;
    if (a.has_recent_workout !== b.has_recent_workout) {
      return a.has_recent_workout ? -1 : 1;
    }
    const aTime = a.active_stories.at(-1)?.created_at ?? "";
    const bTime = b.active_stories.at(-1)?.created_at ?? "";
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });

  // Stories row: only users with active dedicated stories, plus self for the add entry point.
  return feedStories.filter((story) => story.is_self || story.active_stories.length > 0);
}

/** Build feed story cards for favorite training partners (Messages favorites row). */
export async function getFeedStoriesForPartners(
  viewerId: string,
  partners: Profile[]
): Promise<FeedStory[]> {
  if (!partners.length) return [];

  const userIds = partners.map((profile) => profile.id);
  const privacyContext = await getStoryPrivacyContext(viewerId);
  const now = new Date();

  const [{ data: workoutPosts }, activeStories] = await Promise.all([
    getSupabase()
      .from("posts")
      .select("author_id, created_at")
      .in("author_id", userIds)
      .in("post_type", [...WORKOUT_POST_TYPES]),
    fetchActiveStoriesForUsers(userIds),
  ]);

  if (workoutPosts.error) throw workoutPosts.error;

  const datesByUser = new Map<string, string[]>();
  const countByUser = new Map<string, number>();

  for (const row of workoutPosts ?? []) {
    const authorId = row.author_id as string;
    const dates = datesByUser.get(authorId) ?? [];
    dates.push(row.created_at as string);
    datesByUser.set(authorId, dates);
    countByUser.set(authorId, (countByUser.get(authorId) ?? 0) + 1);
  }

  const storiesByUser = new Map<string, FrennixStory[]>();
  for (const story of activeStories) {
    if (!canViewerSeeStoryPrivacy(story.privacy, story.user_id, viewerId, privacyContext)) {
      continue;
    }
    const list = storiesByUser.get(story.user_id) ?? [];
    list.push(story);
    storiesByUser.set(story.user_id, list);
  }

  const viewedByUser = await getStoryViewStatus(viewerId, storiesByUser);

  return partners.map((profile) => {
    const userStories = storiesByUser.get(profile.id) ?? [];
    const streak = computeWorkoutStreakFromDates(datesByUser.get(profile.id) ?? [], now);
    const hasActiveStory = userStories.length > 0;

    return {
      user_id: profile.id,
      profile,
      workout_streak: streak,
      workout_count: countByUser.get(profile.id) ?? 0,
      has_recent_workout: hasActiveStory,
      active_stories: userStories,
      last_workout: null,
      is_self: false,
      viewer_follows: privacyContext.followingIds.has(profile.id),
      viewed: viewedByUser.get(profile.id) ?? true,
    };
  });
}

/** User IDs with at least one non-expired workout story (for inbox story rings). */
export async function getActiveStoryUserIds(userIds: string[]): Promise<Set<string>> {
  if (!userIds.length) return new Set();

  const now = new Date().toISOString();
  const { data, error } = await getSupabase()
    .from("stories")
    .select("user_id")
    .in("user_id", userIds)
    .gt("expires_at", now);

  if (error) throw error;
  return new Set((data ?? []).map((row) => row.user_id as string));
}

/** Flatten all active stories for a feed user into viewer segments. */
export function flattenFeedStorySegments(story: FeedStory): FrennixStory[] {
  return story.active_stories ?? [];
}
