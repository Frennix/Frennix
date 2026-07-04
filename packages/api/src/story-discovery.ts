import type { FrennixStory, Profile, StoryPrivacy } from "@frennix/types";
import { getFollowing } from "./follows";
import { getProfilesByIds } from "./profiles";
import { getSupabase } from "./supabase";

async function fetchStoriesWithSlides(storyRows: Record<string, unknown>[]): Promise<FrennixStory[]> {
  if (!storyRows.length) return [];

  const storyIds = storyRows.map((row) => row.id as string);
  const { data: slideRows, error } = await getSupabase()
    .from("story_slides")
    .select("*")
    .in("story_id", storyIds)
    .order("sort_order", { ascending: true });

  if (error) throw error;

  const slidesByStory = new Map<string, FrennixStory["slides"]>();
  for (const slide of slideRows ?? []) {
    const storyId = slide.story_id as string;
    const list = slidesByStory.get(storyId) ?? [];
    list.push(slide as FrennixStory["slides"][number]);
    slidesByStory.set(storyId, list);
  }

  return storyRows.map((row) => ({
    id: row.id as string,
    user_id: row.user_id as string,
    privacy: row.privacy as FrennixStory["privacy"],
    post_id: row.post_id as string | null,
    workout_tag: row.workout_tag as string | null,
    location_name: row.location_name as string | null,
    location_type: row.location_type as FrennixStory["location_type"],
    challenge_id: row.challenge_id as string | null,
    challenge_prompt: row.challenge_prompt as string | null,
    created_at: row.created_at as string,
    expires_at: row.expires_at as string,
    slides: slidesByStory.get(row.id as string) ?? [],
  }));
}

export type DiscoverStoryItem = {
  story: FrennixStory;
  profile: Profile;
  view_count?: number;
};

export type StoryDiscoveryLane = {
  id: string;
  title: string;
  subtitle: string;
  items: DiscoverStoryItem[];
};

async function getViewerPrivacyContext(viewerId: string) {
  const following = await getFollowing(viewerId);
  const followingIds = new Set(following.map((profile) => profile.id));

  const { data: followersOfViewer } = await getSupabase()
    .from("follows")
    .select("follower_id")
    .eq("following_id", viewerId);

  const mutualFriendIds = new Set<string>();
  for (const row of followersOfViewer ?? []) {
    const followerId = row.follower_id as string;
    if (followingIds.has(followerId)) mutualFriendIds.add(followerId);
  }

  return { followingIds, mutualFriendIds };
}

function canViewerSeeStory(
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

async function attachProfiles(
  stories: FrennixStory[],
  viewCounts?: Map<string, number>
): Promise<DiscoverStoryItem[]> {
  if (!stories.length) return [];

  const userIds = [...new Set(stories.map((story) => story.user_id))];
  const profiles = await getProfilesByIds(userIds);
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  return stories
    .map((story) => {
      const profile = profileById.get(story.user_id);
      if (!profile) return null;
      return {
        story,
        profile,
        view_count: viewCounts?.get(story.id),
      };
    })
    .filter((item): item is DiscoverStoryItem => item !== null);
}

async function filterDiscoverStories(
  viewerId: string,
  storyRows: Record<string, unknown>[]
): Promise<FrennixStory[]> {
  if (!storyRows.length) return [];

  const { followingIds, mutualFriendIds } = await getViewerPrivacyContext(viewerId);
  const visibleRows = storyRows.filter((row) =>
    canViewerSeeStory(
      row.privacy as StoryPrivacy,
      row.user_id as string,
      viewerId,
      followingIds,
      mutualFriendIds
    )
  );

  return fetchStoriesWithSlides(visibleRows);
}

async function fetchActivePublicStories(limit: number): Promise<Record<string, unknown>[]> {
  const now = new Date().toISOString();
  const { data, error } = await getSupabase()
    .from("stories")
    .select("*")
    .gt("expires_at", now)
    .eq("privacy", "everyone")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function getStoryOfTheDay(viewerId: string): Promise<DiscoverStoryItem | null> {
  const now = new Date().toISOString();
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const { data: storyRows, error } = await getSupabase()
    .from("stories")
    .select("*")
    .gt("expires_at", now)
    .gte("created_at", dayStart.toISOString())
    .eq("privacy", "everyone")
    .neq("user_id", viewerId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  if (!storyRows?.length) return null;

  const storyIds = storyRows.map((row) => row.id as string);
  const { data: viewRows } = await getSupabase()
    .from("story_item_views")
    .select("story_id")
    .in("story_id", storyIds);

  const viewCountByStory = new Map<string, number>();
  for (const row of viewRows ?? []) {
    const storyId = row.story_id as string;
    viewCountByStory.set(storyId, (viewCountByStory.get(storyId) ?? 0) + 1);
  }

  const sorted = [...storyRows].sort(
    (a, b) =>
      (viewCountByStory.get(b.id as string) ?? 0) - (viewCountByStory.get(a.id as string) ?? 0)
  );

  const stories = await filterDiscoverStories(viewerId, [sorted[0]]);
  const items = await attachProfiles(stories, viewCountByStory);
  return items[0] ?? null;
}

export async function getPopularStories(viewerId: string, limit = 20): Promise<DiscoverStoryItem[]> {
  const storyRows = await fetchActivePublicStories(limit * 3);
  if (!storyRows.length) return [];

  const storyIds = storyRows.map((row) => row.id as string);
  const { data: viewRows } = await getSupabase()
    .from("story_item_views")
    .select("story_id")
    .in("story_id", storyIds);

  const viewCountByStory = new Map<string, number>();
  for (const row of viewRows ?? []) {
    const storyId = row.story_id as string;
    viewCountByStory.set(storyId, (viewCountByStory.get(storyId) ?? 0) + 1);
  }

  const sorted = [...storyRows]
    .filter((row) => row.user_id !== viewerId)
    .sort(
      (a, b) =>
        (viewCountByStory.get(b.id as string) ?? 0) - (viewCountByStory.get(a.id as string) ?? 0)
    )
    .slice(0, limit);

  const stories = await filterDiscoverStories(viewerId, sorted);
  return attachProfiles(stories, viewCountByStory);
}

export async function getNearbyStories(
  viewerId: string,
  locationHint?: string | null,
  limit = 20
): Promise<DiscoverStoryItem[]> {
  if (!locationHint?.trim()) return [];

  const now = new Date().toISOString();
  const { data: storyRows, error } = await getSupabase()
    .from("stories")
    .select("*")
    .gt("expires_at", now)
    .ilike("location_name", `%${locationHint.trim()}%`)
    .neq("user_id", viewerId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  if (!storyRows?.length) return [];

  const stories = await filterDiscoverStories(viewerId, storyRows);
  return attachProfiles(stories);
}

export async function getFriendsStories(viewerId: string, limit = 30): Promise<DiscoverStoryItem[]> {
  const { followingIds, mutualFriendIds } = await getViewerPrivacyContext(viewerId);
  const friendIds = [...mutualFriendIds];
  if (!friendIds.length) return [];

  const now = new Date().toISOString();
  const { data: storyRows, error } = await getSupabase()
    .from("stories")
    .select("*")
    .in("user_id", friendIds)
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  if (!storyRows?.length) return [];

  const visibleRows = storyRows.filter((row) =>
    canViewerSeeStory(
      row.privacy as StoryPrivacy,
      row.user_id as string,
      viewerId,
      followingIds,
      mutualFriendIds
    )
  );

  const stories = await fetchStoriesWithSlides(visibleRows);
  return attachProfiles(stories);
}

export async function getTrendingChallengeStories(
  viewerId: string,
  limit = 20
): Promise<DiscoverStoryItem[]> {
  const now = new Date().toISOString();
  const { data: storyRows, error } = await getSupabase()
    .from("stories")
    .select("*")
    .gt("expires_at", now)
    .not("challenge_id", "is", null)
    .neq("user_id", viewerId)
    .order("created_at", { ascending: false })
    .limit(limit * 2);

  if (error) throw error;
  if (!storyRows?.length) return [];

  const storyIds = storyRows.map((row) => row.id as string);
  const { data: joinRows } = await getSupabase()
    .from("story_challenge_joins")
    .select("story_id")
    .in("story_id", storyIds);

  const joinCountByStory = new Map<string, number>();
  for (const row of joinRows ?? []) {
    const storyId = row.story_id as string;
    joinCountByStory.set(storyId, (joinCountByStory.get(storyId) ?? 0) + 1);
  }

  const sorted = [...storyRows]
    .sort(
      (a, b) =>
        (joinCountByStory.get(b.id as string) ?? 0) - (joinCountByStory.get(a.id as string) ?? 0)
    )
    .slice(0, limit);

  const stories = await filterDiscoverStories(viewerId, sorted);
  return attachProfiles(stories);
}

export async function getStoryDiscoveryLanes(
  viewerId: string,
  locationHint?: string | null
): Promise<StoryDiscoveryLane[]> {
  const [storyOfDay, popular, nearby, friends, trendingChallenges] = await Promise.all([
    getStoryOfTheDay(viewerId),
    getPopularStories(viewerId, 12),
    getNearbyStories(viewerId, locationHint, 12),
    getFriendsStories(viewerId, 12),
    getTrendingChallengeStories(viewerId, 12),
  ]);

  const lanes: StoryDiscoveryLane[] = [];

  if (storyOfDay) {
    lanes.push({
      id: "story-of-day",
      title: "Story of the Day",
      subtitle: "Most viewed story today",
      items: [storyOfDay],
    });
  }

  if (friends.length) {
    lanes.push({
      id: "friends",
      title: "Friends' Stories",
      subtitle: "Mutual training partners",
      items: friends,
    });
  }

  if (popular.length) {
    lanes.push({
      id: "popular",
      title: "Popular Stories",
      subtitle: "Trending across Frennix",
      items: popular,
    });
  }

  if (nearby.length) {
    lanes.push({
      id: "nearby",
      title: "Nearby Stories",
      subtitle: locationHint ? `Near ${locationHint}` : "Stories near you",
      items: nearby,
    });
  }

  if (trendingChallenges.length) {
    lanes.push({
      id: "trending-challenges",
      title: "Trending Challenges",
      subtitle: "Join the community",
      items: trendingChallenges,
    });
  }

  return lanes;
}

export async function getStoriesByWorkoutTag(
  viewerId: string,
  tag: string,
  limit = 30
): Promise<DiscoverStoryItem[]> {
  const now = new Date().toISOString();

  const { data: storyRows, error } = await getSupabase()
    .from("stories")
    .select("*")
    .gt("expires_at", now)
    .ilike("workout_tag", tag)
    .neq("user_id", viewerId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  if (!storyRows?.length) return [];

  const stories = await filterDiscoverStories(viewerId, storyRows);
  return attachProfiles(stories);
}

export async function getStoriesByLocation(
  viewerId: string,
  locationName: string,
  limit = 30
): Promise<DiscoverStoryItem[]> {
  const now = new Date().toISOString();

  const { data: storyRows, error } = await getSupabase()
    .from("stories")
    .select("*")
    .gt("expires_at", now)
    .ilike("location_name", `%${locationName}%`)
    .neq("user_id", viewerId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  if (!storyRows?.length) return [];

  const stories = await filterDiscoverStories(viewerId, storyRows);
  return attachProfiles(stories);
}
