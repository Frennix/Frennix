import type { FeedStory, FrennixStory, Profile, StoryLocationType, StoryPrivacy, StorySlide } from "@frennix/types";
import { getFollowing } from "./follows";
import { normalizeProfile } from "./profile-normalize";
import { computeWorkoutStreakFromDates } from "./streaks";
import { getSupabase } from "./supabase";

const WORKOUT_POST_TYPES = ["workout_update", "photo", "video"] as const;

function canViewerSeeStoryPrivacy(
  privacy: StoryPrivacy,
  authorId: string,
  viewerId: string,
  followingIds: Set<string>,
  mutualFriendIds: Set<string>
): boolean {
  if (authorId === viewerId) return true;
  if (privacy === "everyone") return true;
  if (privacy === "friends") return mutualFriendIds.has(authorId);
  if (privacy === "followers") return followingIds.has(authorId);
  return false;
}

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

  return storyRows.map((row) => ({
    id: row.id as string,
    user_id: row.user_id as string,
    privacy: row.privacy as StoryPrivacy,
    post_id: row.post_id as string | null,
    workout_tag: row.workout_tag as string | null,
    location_name: row.location_name as string | null,
    location_type: row.location_type as StoryLocationType | null,
    challenge_id: row.challenge_id as string | null,
    challenge_prompt: row.challenge_prompt as string | null,
    created_at: row.created_at as string,
    expires_at: row.expires_at as string,
    slides: slidesByStory.get(row.id as string) ?? [],
  }));
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
  const [selfProfile, following] = await Promise.all([
    getSupabase().from("profiles_reader").select("*").eq("id", viewerId).single(),
    getFollowing(viewerId),
  ]);

  if (selfProfile.error) throw selfProfile.error;

  const self = normalizeProfile(selfProfile.data as Profile);
  if (!self) return [];

  const profiles: Profile[] = [
    self,
    ...following.map((row) => normalizeProfile(row)).filter((row): row is Profile => Boolean(row)),
  ];
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
      !canViewerSeeStoryPrivacy(
        story.privacy,
        story.user_id,
        viewerId,
        followingIds,
        mutualFriendIds
      )
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
      viewer_follows: profile.id === viewerId || followingIds.has(profile.id),
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
  const following = await getFollowing(viewerId);
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
      !canViewerSeeStoryPrivacy(
        story.privacy,
        story.user_id,
        viewerId,
        followingIds,
        mutualFriendIds
      )
    ) {
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
      viewer_follows: followingIds.has(profile.id),
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
