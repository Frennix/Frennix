import type {
  Challenge,
  ChallengeInvitation,
  ChallengeInvitationStatus,
  ChallengeParticipant,
  Post,
  Profile,
} from "@frennix/types";
import { getFollowers, getFollowing } from "./follows";
import { getMatches } from "./matching";
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
  if (!data) throw new Error("Challenge created but no data returned");

  const { error: joinError } = await getSupabase().from("challenge_participants").insert({
    challenge_id: data.id,
    user_id: input.created_by,
    status: "active",
  });
  if (joinError && joinError.code !== "23505") {
    throw formatSupabaseError(joinError, "Failed to join challenge as creator");
  }

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
  return enrichChallengeParticipantCount(data as Challenge);
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
      try {
        await getSupabase().storage.from("avatars").remove([path]);
      } catch {
        // Best-effort storage cleanup — do not block challenge deletion.
      }
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

export async function getChallengeParticipants(
  challengeId: string
): Promise<ChallengeParticipant[]> {
  const { data, error } = await getSupabase()
    .from("challenge_participants")
    .select(`*, profile:profiles!challenge_participants_user_id_fkey(*)`)
    .eq("challenge_id", challengeId)
    .eq("status", "active")
    .order("joined_at", { ascending: true });

  if (error) throw formatSupabaseError(error, "Failed to load participants");

  return (data ?? []).map((row) => {
    const entry = row as ChallengeParticipant & { profile: Profile | Profile[] | null };
    const profile = Array.isArray(entry.profile) ? entry.profile[0] : entry.profile;
    return { ...entry, profile: profile ?? undefined };
  });
}

export async function closeChallengeEarly(challengeId: string, userId: string) {
  const now = new Date().toISOString();
  const { data, error } = await getSupabase()
    .from("challenges")
    .update({ end_date: now })
    .eq("id", challengeId)
    .eq("created_by", userId)
    .gt("end_date", now)
    .select()
    .single();

  if (error) throw formatSupabaseError(error, "Failed to close challenge");
  if (!data) throw new Error("Challenge is already closed or you are not the creator");
  return data as Challenge;
}

function isChallengeOpen(challenge: Challenge) {
  return new Date(challenge.end_date).getTime() > Date.now();
}

export async function getChallengeInviteCandidates(userId: string): Promise<Profile[]> {
  const [following, followers, matches] = await Promise.all([
    getFollowing(userId),
    getFollowers(userId),
    getMatches(userId),
  ]);

  const byId = new Map<string, Profile>();
  for (const profile of [...following, ...followers]) {
    byId.set(profile.id, profile);
  }
  for (const match of matches) {
    if (match.other_user) byId.set(match.other_user.id, match.other_user);
  }
  byId.delete(userId);

  return Array.from(byId.values()).sort((a, b) =>
    a.display_name.localeCompare(b.display_name)
  );
}

export async function getChallengeInvitationsByInviter(
  challengeId: string,
  inviterId: string
): Promise<ChallengeInvitation[]> {
  const { data, error } = await getSupabase()
    .from("challenge_invitations")
    .select("challenge_id, inviter_id, invitee_id, status, created_at, updated_at")
    .eq("challenge_id", challengeId)
    .eq("inviter_id", inviterId);

  if (error) throw formatSupabaseError(error, "Failed to load challenge invitations");
  return (data ?? []) as ChallengeInvitation[];
}

export async function inviteToChallenge(
  challengeId: string,
  inviterId: string,
  inviteeId: string
) {
  if (inviterId === inviteeId) throw new Error("You cannot invite yourself");

  const challenge = await getChallenge(challengeId);
  if (!challenge) throw new Error("Challenge not found");
  if (!isChallengeOpen(challenge)) throw new Error("This challenge has ended");

  const alreadyJoined = await isChallengeParticipant(challengeId, inviteeId);
  if (alreadyJoined) throw new Error("This athlete already joined the challenge");

  const { error } = await getSupabase().from("challenge_invitations").insert({
    challenge_id: challengeId,
    inviter_id: inviterId,
    invitee_id: inviteeId,
    status: "pending",
  });

  if (error) {
    if (error.code === "23505") throw new Error("This athlete was already invited");
    throw formatSupabaseError(error, "Failed to send invitation");
  }
}

export async function declineChallengeInvite(challengeId: string, inviteeId: string, inviterId: string) {
  const { error } = await getSupabase()
    .from("challenge_invitations")
    .update({ status: "declined", updated_at: new Date().toISOString() })
    .eq("challenge_id", challengeId)
    .eq("invitee_id", inviteeId)
    .eq("inviter_id", inviterId)
    .eq("status", "pending");

  if (error) throw formatSupabaseError(error, "Failed to decline invitation");
}
