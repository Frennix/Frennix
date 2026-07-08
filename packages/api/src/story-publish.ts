import type {
  FrennixStory,
  StoryLocationType,
  StoryPrivacy,
  StorySlide,
  StorySlideMediaType,
  WorkoutStoryMetrics,
} from "@frennix/types";
import { isVideoMime, normalizeMediaExt } from "./media-utils";
import {
  IMAGE_UPLOAD_TIMEOUT_MS,
  VIDEO_UPLOAD_TIMEOUT_MS,
  readMediaUploadBody,
  withTimeout,
} from "./upload-utils";
import { getSupabase } from "./supabase";
import { formatSupabaseError } from "./profile-utils";
import { publishPlatformActivity } from "./platform-activity-engine";

const STORY_TTL_MS = 24 * 60 * 60 * 1000;

export type PublishStorySlideInput = {
  media_url?: string | null;
  media_type: StorySlideMediaType;
  caption?: string | null;
  workout_type?: string | null;
  workout_data?: WorkoutStoryMetrics | null;
  sort_order: number;
  slide_meta?: Record<string, unknown>;
};

export type PublishStoryInput = {
  user_id: string;
  privacy?: StoryPrivacy;
  post_id?: string | null;
  workout_tag?: string | null;
  location_name?: string | null;
  location_type?: StoryLocationType | null;
  challenge_id?: string | null;
  challenge_prompt?: string | null;
  slides: PublishStorySlideInput[];
  mentioned_usernames?: string[];
};

export async function uploadStoryMedia(
  userId: string,
  uri: string,
  mimeType: string,
  file?: File | null
) {
  const ext = normalizeMediaExt(mimeType);
  const fileName = `${userId}/stories/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const body = await readMediaUploadBody(uri, mimeType, file);
  const contentType = mimeType.includes("/")
    ? mimeType
    : ext === "mov" || ext === "mp4" || ext === "webm"
      ? "video/mp4"
      : "image/jpeg";

  const timeoutMs = isVideoMime(mimeType) ? VIDEO_UPLOAD_TIMEOUT_MS : IMAGE_UPLOAD_TIMEOUT_MS;

  const { error } = await withTimeout(
    getSupabase().storage.from("posts").upload(fileName, body, { contentType, upsert: false }),
    timeoutMs,
    "Story media upload"
  );

  if (error) throw formatSupabaseError(error, "Story media upload failed");

  const { data } = getSupabase().storage.from("posts").getPublicUrl(fileName);
  return data.publicUrl;
}

function parseMentions(text: string): string[] {
  const matches = text.match(/@([a-zA-Z0-9_]{2,30})/g) ?? [];
  return [...new Set(matches.map((token) => token.slice(1).toLowerCase()))];
}

async function resolveMentionedUserIds(usernames: string[]): Promise<Map<string, string>> {
  if (!usernames.length) return new Map();

  const { data, error } = await getSupabase()
    .from("profiles")
    .select("id, username")
    .in("username", usernames);

  if (error) throw error;

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    map.set((row.username as string).toLowerCase(), row.id as string);
  }
  return map;
}

export async function publishStory(input: PublishStoryInput): Promise<FrennixStory> {
  if (!input.slides.length) throw new Error("Add at least one story slide");

  const expiresAt = new Date(Date.now() + STORY_TTL_MS).toISOString();

  const { data: storyRow, error: storyError } = await getSupabase()
    .from("stories")
    .insert({
      user_id: input.user_id,
      privacy: input.privacy ?? "followers",
      post_id: input.post_id ?? null,
      workout_tag: input.workout_tag ?? null,
      location_name: input.location_name ?? null,
      location_type: input.location_type ?? null,
      challenge_id: input.challenge_id ?? null,
      challenge_prompt: input.challenge_prompt ?? null,
      expires_at: expiresAt,
    })
    .select("*")
    .single();

  if (storyError) throw storyError;

  const storyId = storyRow.id as string;

  const slideRows = input.slides.map((slide) => ({
    story_id: storyId,
    media_url: slide.media_url ?? null,
    media_type: slide.media_type,
    caption: slide.caption ?? null,
    workout_type: slide.workout_type ?? null,
    workout_data: slide.workout_data ?? {},
    sort_order: slide.sort_order,
    slide_meta: slide.slide_meta ?? {},
  }));

  const { data: insertedSlides, error: slidesError } = await getSupabase()
    .from("story_slides")
    .insert(slideRows)
    .select("*")
    .order("sort_order", { ascending: true });

  if (slidesError) throw slidesError;

  const mentionUsernames = new Set<string>(input.mentioned_usernames ?? []);
  for (const slide of input.slides) {
    for (const username of parseMentions(slide.caption ?? "")) {
      mentionUsernames.add(username);
    }
  }

  const mentionMap = await resolveMentionedUserIds([...mentionUsernames]);
  if (mentionMap.size) {
    const mentionRows = [...mentionMap.entries()].map(([_, mentionedUserId]) => ({
      story_id: storyId,
      mentioned_user_id: mentionedUserId,
    }));

    const { error: mentionError } = await getSupabase().from("story_mentions").insert(mentionRows);
    if (mentionError) throw mentionError;

    const { createNotification } = await import("./notifications");
    for (const mentionedUserId of mentionMap.values()) {
      if (mentionedUserId === input.user_id) continue;
      await createNotification({
        user_id: mentionedUserId,
        type: "story_mention",
        actor_id: input.user_id,
        payload: {
          story_id: storyId,
          mentioner_id: input.user_id,
        },
      }).catch(() => undefined);
    }
  }

  await publishPlatformActivity({
    userId: input.user_id,
    activityType: "story_posted",
    sourceType: "stories",
    sourceId: storyId,
    metadata: {
      slide_count: input.slides.length,
      workout_tag: input.workout_tag ?? null,
    },
  }).catch(() => undefined);

  return {
    id: storyId,
    user_id: input.user_id,
    privacy: storyRow.privacy as StoryPrivacy,
    post_id: storyRow.post_id as string | null,
    workout_tag: storyRow.workout_tag as string | null,
    location_name: storyRow.location_name as string | null,
    location_type: storyRow.location_type as StoryLocationType | null,
    challenge_id: storyRow.challenge_id as string | null,
    challenge_prompt: storyRow.challenge_prompt as string | null,
    created_at: storyRow.created_at as string,
    expires_at: storyRow.expires_at as string,
    slides: (insertedSlides ?? []) as StorySlide[],
  };
}

export async function getUserActiveStories(userId: string): Promise<FrennixStory[]> {
  const now = new Date().toISOString();

  const { data: stories, error } = await getSupabase()
    .from("stories")
    .select("*")
    .eq("user_id", userId)
    .gt("expires_at", now)
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!stories?.length) return [];

  const storyIds = stories.map((row) => row.id as string);

  const { data: slides, error: slidesError } = await getSupabase()
    .from("story_slides")
    .select("*")
    .in("story_id", storyIds)
    .order("sort_order", { ascending: true });

  if (slidesError) throw slidesError;

  const slidesByStory = new Map<string, StorySlide[]>();
  for (const slide of slides ?? []) {
    const storyId = slide.story_id as string;
    const list = slidesByStory.get(storyId) ?? [];
    list.push(slide as StorySlide);
    slidesByStory.set(storyId, list);
  }

  return stories.map((row) => ({
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
