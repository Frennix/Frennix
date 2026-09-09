import type { FrennixStory, StoryPrivacy } from "@frennix/types";
import { extractPostsStoragePath, removePostsStorageFiles } from "./posts";
import { formatSupabaseError } from "./profile-utils";
import { getSupabase } from "./supabase";
import {
  extractStoriesStoragePath,
  mapDedicatedStory,
  resolveStorySlides,
} from "./story-privacy";

const deleteInFlight = new Set<string>();

export type StoryControlsPatch = {
  privacy?: StoryPrivacy;
  commenting_enabled?: boolean;
};

export async function getVisibleStory(storyId: string): Promise<FrennixStory | null> {
  const { data, error } = await getSupabase()
    .from("stories")
    .select("*")
    .eq("id", storyId)
    .maybeSingle();

  if (error) throw formatSupabaseError(error, "Failed to load story");
  if (!data) return null;

  const { data: slides, error: slidesError } = await getSupabase()
    .from("story_slides")
    .select("*")
    .eq("story_id", storyId)
    .order("sort_order", { ascending: true });

  if (slidesError) throw formatSupabaseError(slidesError, "Failed to load story slides");

  return mapDedicatedStory(data as Record<string, unknown>, await resolveStorySlides(slides ?? []));
}

export async function assertCanViewStory(storyId: string): Promise<FrennixStory> {
  const story = await getVisibleStory(storyId);
  if (!story) throw new Error("Story not found");
  return story;
}

export async function assertCanReplyToStory(storyId: string): Promise<FrennixStory> {
  const story = await assertCanViewStory(storyId);
  if (!story.commenting_enabled) {
    throw new Error("Commenting is turned off for this story");
  }
  return story;
}

export async function updateStoryControls(
  storyId: string,
  userId: string,
  patch: StoryControlsPatch
): Promise<FrennixStory> {
  const updates: Record<string, unknown> = {};
  if (patch.privacy) updates.privacy = patch.privacy;
  if (patch.commenting_enabled !== undefined) updates.commenting_enabled = patch.commenting_enabled;
  if (!Object.keys(updates).length) {
    const current = await getVisibleStory(storyId);
    if (!current || current.user_id !== userId) throw new Error("You can only update your own story");
    return current;
  }

  const { data, error } = await getSupabase()
    .from("stories")
    .update(updates)
    .eq("id", storyId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw formatSupabaseError(error, "Failed to update story");
  if (!data) throw new Error("You can only update your own story");

  const { data: slides, error: slidesError } = await getSupabase()
    .from("story_slides")
    .select("*")
    .eq("story_id", storyId)
    .order("sort_order", { ascending: true });

  if (slidesError) throw formatSupabaseError(slidesError, "Failed to load story slides");

  return mapDedicatedStory(data as Record<string, unknown>, await resolveStorySlides(slides ?? []));
}

async function collectUnreferencedMediaUrls(storyId: string, userId: string, urls: string[]) {
  const unique = [...new Set(urls.filter(Boolean))];
  const removable: string[] = [];

  for (const url of unique) {
    const { count: slideCount, error: slideError } = await getSupabase()
      .from("story_slides")
      .select("id", { count: "exact", head: true })
      .eq("media_url", url)
      .neq("story_id", storyId);
    if (slideError) throw formatSupabaseError(slideError, "Failed to check story media references");
    if ((slideCount ?? 0) > 0) continue;

    const { count: postMediaCount, error: postMediaError } = await getSupabase()
      .from("posts")
      .select("id", { count: "exact", head: true })
      .contains("media_urls", [url]);
    if (postMediaError) throw formatSupabaseError(postMediaError, "Failed to check post media references");
    if ((postMediaCount ?? 0) > 0) continue;

    const { count: thumbCount, error: thumbError } = await getSupabase()
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("thumbnail_url", url);
    if (thumbError) throw formatSupabaseError(thumbError, "Failed to check thumbnail references");
    if ((thumbCount ?? 0) > 0) continue;

    const { data: memories, error: memoryError } = await getSupabase()
      .from("story_memories")
      .select("story_snapshot")
      .eq("user_id", userId);
    if (memoryError) throw formatSupabaseError(memoryError, "Failed to check story memories");
    const remembered = (memories ?? []).some((row) =>
      JSON.stringify(row.story_snapshot ?? {}).includes(url)
    );
    if (remembered) continue;

    removable.push(url);
  }

  return removable;
}

async function removeStoryStorageFiles(urls: string[]) {
  const postUrls = urls.filter((url) => extractPostsStoragePath(url));
  if (postUrls.length) {
    await removePostsStorageFiles(postUrls);
  }

  const storyPaths = urls
    .map((url) => extractStoriesStoragePath(url))
    .filter((path): path is string => Boolean(path));

  const uniquePaths = [...new Set(storyPaths)];
  if (!uniquePaths.length) return;

  const { error } = await getSupabase().storage.from("stories").remove(uniquePaths);
  if (error) throw formatSupabaseError(error, "Failed to delete story media");
}

export async function deleteStory(storyId: string, userId: string): Promise<void> {
  if (deleteInFlight.has(storyId)) return;
  deleteInFlight.add(storyId);

  try {
    const { data: story, error: fetchError } = await getSupabase()
      .from("stories")
      .select("id, user_id")
      .eq("id", storyId)
      .maybeSingle();

    if (fetchError) throw formatSupabaseError(fetchError, "Failed to load story");
    if (!story) throw new Error("Story not found");
    if (story.user_id !== userId) throw new Error("You can only delete your own story");

    const { data: slides, error: slidesError } = await getSupabase()
      .from("story_slides")
      .select("media_url")
      .eq("story_id", storyId);

    if (slidesError) throw formatSupabaseError(slidesError, "Failed to load story media");

    const mediaUrls = (slides ?? [])
      .map((slide) => slide.media_url as string | null)
      .filter((url): url is string => Boolean(url));
    const removable = await collectUnreferencedMediaUrls(storyId, userId, mediaUrls);

    const { error: deleteError } = await getSupabase()
      .from("stories")
      .delete()
      .eq("id", storyId)
      .eq("user_id", userId);

    if (deleteError) throw formatSupabaseError(deleteError, "Failed to delete story");

    const { data: remaining, error: remainingError } = await getSupabase()
      .from("stories")
      .select("id")
      .eq("id", storyId)
      .maybeSingle();
    if (remainingError) throw formatSupabaseError(remainingError, "Failed to confirm story deletion");
    if (remaining) throw new Error("Failed to delete story");

    if (removable.length) {
      await removeStoryStorageFiles(removable);
    }
  } finally {
    deleteInFlight.delete(storyId);
  }
}
