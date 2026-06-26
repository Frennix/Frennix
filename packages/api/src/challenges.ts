import type { Challenge, Post } from "@frennix/types";
import { enrichPostsWithInteractions } from "./posts";
import { formatSupabaseError, normalizeImageExt, readImageBytes } from "./profile-utils";
import { getSupabase } from "./supabase";

export type UpdateChallengePatch = {
  title?: string;
  description?: string | null;
  rules?: string | null;
  cover_image_url?: string | null;
  start_date?: string;
  end_date?: string;
};

function extractAvatarsStoragePath(publicUrl: string): string | null {
  const markers = ["/storage/v1/object/public/avatars/", "/object/public/avatars/"];
  for (const marker of markers) {
    const idx = publicUrl.indexOf(marker);
    if (idx !== -1) {
      return decodeURIComponent(publicUrl.slice(idx + marker.length).split("?")[0] ?? "");
    }
  }
  return null;
}

async function enrichChallengeParticipantCount(challenge: Challenge): Promise<Challenge> {
  const { count } = await getSupabase()
    .from("challenge_participants")
    .select("*", { count: "exact", head: true })
    .eq("challenge_id", challenge.id);
  return { ...challenge, participant_count: count ?? 0 };
}

export async function getChallenges(): Promise<Challenge[]> {
  const { data, error } = await getSupabase()
    .from("challenges")
    .select("*")
    .gte("end_date", new Date().toISOString())
    .order("start_date", { ascending: true })
    .limit(30);
  if (error) throw formatSupabaseError(error, "Failed to load challenges");

  return Promise.all(((data ?? []) as Challenge[]).map(enrichChallengeParticipantCount));
}

export async function getChallenge(id: string): Promise<Challenge | null> {
  const { data, error } = await getSupabase().from("challenges").select("*").eq("id", id).maybeSingle();
  if (error) throw formatSupabaseError(error, "Failed to load challenge");
  if (!data) return null;
  return enrichChallengeParticipantCount(data as Challenge);
}

export async function createChallenge(input: {
  title: string;
  description?: string;
  rules?: string | null;
  cover_image_url?: string | null;
  start_date: string;
  end_date: string;
  created_by: string;
  group_id?: string | null;
}) {
  const { data, error } = await getSupabase().from("challenges").insert(input).select().single();
  if (error) throw formatSupabaseError(error, "Failed to create challenge");
  return data as Challenge;
}

export async function updateChallenge(
  challengeId: string,
  userId: string,
  patch: UpdateChallengePatch,
  options?: { removedCoverUrl?: string | null }
) {
  if (options?.removedCoverUrl) {
    const path = extractAvatarsStoragePath(options.removedCoverUrl);
    if (path) {
      const { error: storageError } = await getSupabase().storage.from("avatars").remove([path]);
      if (storageError) throw formatSupabaseError(storageError, "Failed to remove challenge cover");
    }
  }

  const { data, error } = await getSupabase()
    .from("challenges")
    .update(patch)
    .eq("id", challengeId)
    .eq("created_by", userId)
    .select()
    .single();

  if (error) throw formatSupabaseError(error, "Failed to update challenge");
  if (!data) throw new Error("Challenge update did not return a row");
  return data as Challenge;
}

export async function deleteChallenge(challengeId: string, userId: string) {
  const { data: challenge, error: fetchError } = await getSupabase()
    .from("challenges")
    .select("id, created_by, cover_image_url")
    .eq("id", challengeId)
    .single();

  if (fetchError) throw formatSupabaseError(fetchError, "Failed to load challenge");
  if (!challenge) throw new Error("Challenge not found");
  if (challenge.created_by !== userId) throw new Error("You can only delete your own challenges");

  if (challenge.cover_image_url) {
    const path = extractAvatarsStoragePath(challenge.cover_image_url as string);
    if (path) {
      await getSupabase().storage.from("avatars").remove([path]);
    }
  }

  const { error: deleteError } = await getSupabase()
    .from("challenges")
    .delete()
    .eq("id", challengeId)
    .eq("created_by", userId);

  if (deleteError) throw formatSupabaseError(deleteError, "Failed to delete challenge");
}

export async function uploadChallengeCover(
  userId: string,
  challengeId: string,
  uri: string,
  mimeType: string,
  file?: File | null
) {
  const ext = normalizeImageExt(mimeType);
  const path = `${userId}/challenge-${challengeId}-${Date.now()}.${ext}`;
  const bytes = await readImageBytes(uri, file);
  const contentType = mimeType.startsWith("image/") ? mimeType : "image/jpeg";

  const { error: uploadError } = await getSupabase()
    .storage
    .from("avatars")
    .upload(path, bytes, { contentType, upsert: false });

  if (uploadError) throw formatSupabaseError(uploadError, "Challenge cover upload failed");

  const { data: urlData } = getSupabase().storage.from("avatars").getPublicUrl(path);
  if (!urlData.publicUrl) throw new Error("Cover uploaded but public URL was not returned");
  return urlData.publicUrl;
}

export async function joinChallenge(challengeId: string, userId: string) {
  const { error } = await getSupabase().from("challenge_participants").insert({
    challenge_id: challengeId,
    user_id: userId,
    status: "active",
  });
  if (error) throw formatSupabaseError(error, "Failed to join challenge");
}

export async function isChallengeParticipant(challengeId: string, userId: string) {
  const { data } = await getSupabase()
    .from("challenge_participants")
    .select("user_id")
    .eq("challenge_id", challengeId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

export async function getChallengePosts(challengeId: string, viewerId?: string) {
  const { data, error } = await getSupabase()
    .from("posts")
    .select(`*, author:profiles!posts_author_id_fkey(*)`)
    .eq("challenge_id", challengeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const posts = (data ?? []) as Post[];
  if (viewerId) return enrichPostsWithInteractions(posts, viewerId);
  return posts;
}
