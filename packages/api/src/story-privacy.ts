import type { FrennixStory, StoryLocationType, StoryPrivacy, StorySlide } from "@frennix/types";
import { getFollowing } from "./follows";
import { getProfilesByIds } from "./profiles";
import { getSupabase } from "./supabase";

export const STORY_PRIVATE_MEDIA_PREFIX = "stories-private:";
const STORY_SIGNED_URL_TTL_SECONDS = 15 * 60;

export type StoryPrivacyContext = {
  followingIds: Set<string>;
  mutualFriendIds: Set<string>;
  connectedIds: Set<string>;
};

export function canViewerSeeStoryPrivacy(
  privacy: StoryPrivacy,
  authorId: string,
  viewerId: string,
  context: StoryPrivacyContext
): boolean {
  if (authorId === viewerId) return true;
  if (privacy === "everyone") return true;
  if (privacy === "only_me") return false;
  if (privacy === "connections") return context.connectedIds.has(authorId);
  if (privacy === "friends") return context.mutualFriendIds.has(authorId);
  if (privacy === "followers") return context.followingIds.has(authorId);
  return false;
}

export async function getConnectedUserIds(viewerId: string): Promise<Set<string>> {
  const { data, error } = await getSupabase().rpc("get_training_matches");
  if (error || !data) return new Set();

  const ids = new Set<string>();
  for (const row of data as Array<{ user_a: string; user_b: string }>) {
    const otherId = row.user_a === viewerId ? row.user_b : row.user_a;
    if (otherId) ids.add(otherId);
  }
  return ids;
}

export async function getStoryPrivacyContext(viewerId: string): Promise<StoryPrivacyContext> {
  const [following, connectedIds] = await Promise.all([
    getFollowing(viewerId),
    getConnectedUserIds(viewerId),
  ]);
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

  return { followingIds, mutualFriendIds, connectedIds };
}

export async function getConnectedProfiles(viewerId: string, existingIds: Set<string>) {
  const extraIds = [...(await getConnectedUserIds(viewerId))].filter(
    (id) => id !== viewerId && !existingIds.has(id)
  );
  if (!extraIds.length) return [];
  return getProfilesByIds(extraIds);
}

export function mapDedicatedStory(
  row: Record<string, unknown>,
  slides: StorySlide[] = []
): FrennixStory {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    privacy: row.privacy as StoryPrivacy,
    commenting_enabled: row.commenting_enabled !== false,
    post_id: row.post_id as string | null,
    workout_tag: row.workout_tag as string | null,
    location_name: row.location_name as string | null,
    location_type: row.location_type as StoryLocationType | null,
    challenge_id: row.challenge_id as string | null,
    challenge_prompt: row.challenge_prompt as string | null,
    created_at: row.created_at as string,
    expires_at: row.expires_at as string,
    slides,
  };
}

export function isPrivateStoryMediaUrl(url: string | null | undefined): boolean {
  return Boolean(url?.startsWith(STORY_PRIVATE_MEDIA_PREFIX));
}

export function extractStoriesStoragePath(url: string): string | null {
  if (url.startsWith(STORY_PRIVATE_MEDIA_PREFIX)) {
    return url.slice(STORY_PRIVATE_MEDIA_PREFIX.length) || null;
  }
  const markers = ["/storage/v1/object/sign/stories/", "/object/sign/stories/"];
  for (const marker of markers) {
    const idx = url.indexOf(marker);
    if (idx !== -1) {
      return decodeURIComponent(url.slice(idx + marker.length).split("?")[0] ?? "");
    }
  }
  return null;
}

export async function resolveStoryMediaUrl(mediaUrl: string | null): Promise<string | null> {
  if (!mediaUrl) return null;
  const path = extractStoriesStoragePath(mediaUrl);
  if (!path || !isPrivateStoryMediaUrl(mediaUrl)) {
    return mediaUrl;
  }

  const { data, error } = await getSupabase()
    .storage.from("stories")
    .createSignedUrl(path, STORY_SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function resolveStorySlides(slides: StorySlide[]): Promise<StorySlide[]> {
  const privatePaths = slides
    .map((slide) =>
      isPrivateStoryMediaUrl(slide.media_url) ? extractStoriesStoragePath(slide.media_url ?? "") : null
    )
    .filter((path): path is string => Boolean(path));

  const signedByPath = new Map<string, string>();
  if (privatePaths.length) {
    const unique = [...new Set(privatePaths)];
    const { data, error } = await getSupabase()
      .storage.from("stories")
      .createSignedUrls(unique, STORY_SIGNED_URL_TTL_SECONDS);
    if (!error && data) {
      for (const item of data) {
        if (item.path && item.signedUrl) signedByPath.set(item.path, item.signedUrl);
      }
    }
  }

  return slides.map((slide) => {
    if (!isPrivateStoryMediaUrl(slide.media_url)) return slide;
    const path = extractStoriesStoragePath(slide.media_url ?? "");
    if (!path) return { ...slide, media_url: null };
    return { ...slide, media_url: signedByPath.get(path) ?? null };
  });
}

export async function hydrateDedicatedStories(
  rows: Record<string, unknown>[],
  slidesByStory: Map<string, StorySlide[]>
): Promise<FrennixStory[]> {
  const stories = await Promise.all(
    rows.map(async (row) => {
      const slides = await resolveStorySlides(slidesByStory.get(row.id as string) ?? []);
      return mapDedicatedStory(row, slides);
    })
  );
  return stories;
}
