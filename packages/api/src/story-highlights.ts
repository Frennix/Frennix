import type { FrennixStory, StoryHighlightCategory } from "@frennix/types";
import { getSupabase } from "./supabase";

export type StoryHighlight = {
  id: string;
  user_id: string;
  title: string;
  category: StoryHighlightCategory | string;
  cover_story_id: string | null;
  created_at: string;
  story_ids: string[];
};

export async function getProfileHighlights(profileId: string): Promise<StoryHighlight[]> {
  const { data: highlightRows, error } = await getSupabase()
    .from("story_highlights")
    .select("*")
    .eq("user_id", profileId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!highlightRows?.length) return [];

  const highlightIds = highlightRows.map((row) => row.id as string);

  const { data: itemRows, error: itemsError } = await getSupabase()
    .from("story_highlight_items")
    .select("highlight_id, story_id, post_id, sort_order")
    .in("highlight_id", highlightIds)
    .order("sort_order", { ascending: true });

  if (itemsError) throw itemsError;

  const storyIdsByHighlight = new Map<string, string[]>();
  for (const row of itemRows ?? []) {
    const highlightId = row.highlight_id as string;
    const storyId = row.story_id as string | null;
    if (!storyId) continue;
    const list = storyIdsByHighlight.get(highlightId) ?? [];
    list.push(storyId);
    storyIdsByHighlight.set(highlightId, list);
  }

  return highlightRows.map((row) => ({
    id: row.id as string,
    user_id: row.user_id as string,
    title: row.title as string,
    category: row.category as string,
    cover_story_id: (row.cover_story_id as string | null) ?? null,
    created_at: row.created_at as string,
    story_ids: storyIdsByHighlight.get(row.id as string) ?? [],
  }));
}

export async function createStoryHighlight(
  userId: string,
  title: string,
  category: StoryHighlightCategory | string = "custom"
): Promise<StoryHighlight> {
  const { data, error } = await getSupabase()
    .from("story_highlights")
    .insert({
      user_id: userId,
      title: title.trim(),
      category,
    })
    .select("*")
    .single();

  if (error) throw error;

  return {
    id: data.id as string,
    user_id: userId,
    title: data.title as string,
    category: data.category as string,
    cover_story_id: null,
    created_at: data.created_at as string,
    story_ids: [],
  };
}

export async function addStoryToHighlight(
  userId: string,
  highlightId: string,
  storyId: string
): Promise<void> {
  const { data: highlight, error: highlightError } = await getSupabase()
    .from("story_highlights")
    .select("id")
    .eq("id", highlightId)
    .eq("user_id", userId)
    .maybeSingle();

  if (highlightError) throw highlightError;
  if (!highlight) throw new Error("Highlight not found");

  const { count } = await getSupabase()
    .from("story_highlight_items")
    .select("*", { count: "exact", head: true })
    .eq("highlight_id", highlightId);

  const { error } = await getSupabase().from("story_highlight_items").insert({
    highlight_id: highlightId,
    story_id: storyId,
    post_id: null,
    sort_order: count ?? 0,
  });

  if (error && error.code !== "23505") throw error;

  await getSupabase()
    .from("story_highlights")
    .update({ cover_story_id: storyId })
    .eq("id", highlightId)
    .is("cover_story_id", null);
}

export async function getHighlightStories(highlightId: string): Promise<FrennixStory[]> {
  const { data: items, error } = await getSupabase()
    .from("story_highlight_items")
    .select("story_id")
    .eq("highlight_id", highlightId)
    .not("story_id", "is", null)
    .order("sort_order", { ascending: true });

  if (error) throw error;

  const storyIds = (items ?? [])
    .map((row) => row.story_id as string | null)
    .filter((id): id is string => Boolean(id));

  if (!storyIds.length) return [];

  const { data: storyRows, error: storiesError } = await getSupabase()
    .from("stories")
    .select("*")
    .in("id", storyIds);

  if (storiesError) throw storiesError;
  if (!storyRows?.length) return [];

  const { data: slideRows, error: slidesError } = await getSupabase()
    .from("story_slides")
    .select("*")
    .in("story_id", storyIds)
    .order("sort_order", { ascending: true });

  if (slidesError) throw slidesError;

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
