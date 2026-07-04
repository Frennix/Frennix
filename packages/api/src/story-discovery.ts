import type { FrennixStory, Profile } from "@frennix/types";
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
};

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

  const stories = await fetchStoriesWithSlides(storyRows);
  const userIds = [...new Set(stories.map((story) => story.user_id))];
  const profiles = await getProfilesByIds(userIds);
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  return stories
    .map((story) => {
      const profile = profileById.get(story.user_id);
      if (!profile) return null;
      return { story, profile };
    })
    .filter((item): item is DiscoverStoryItem => item !== null);
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

  const stories = await fetchStoriesWithSlides(storyRows);
  const userIds = [...new Set(stories.map((story) => story.user_id))];
  const profiles = await getProfilesByIds(userIds);
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  return stories
    .map((story) => {
      const profile = profileById.get(story.user_id);
      if (!profile) return null;
      return { story, profile };
    })
    .filter((item): item is DiscoverStoryItem => item !== null);
}
