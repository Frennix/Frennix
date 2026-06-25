import type { Profile, ProfileStats } from "@frennix/types";
import { getFollowCounts } from "./follows";
import { getBlockedIds } from "./moderation";
import {
  formatSupabaseError,
  logProfileError,
  normalizeImageExt,
  readImageBytes,
} from "./profile-utils";
import { computeWorkoutStreakFromDates } from "./streaks";
import { getSupabase } from "./supabase";

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await getSupabase()
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data as Profile | null;
}

export async function getProfileByUsername(username: string): Promise<Profile | null> {
  const { data, error } = await getSupabase()
    .from("profiles")
    .select("*")
    .eq("username", username)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data as Profile | null;
}

export async function upsertProfile(profile: Partial<Profile> & { id: string }) {
  const { id, ...patch } = profile;
  console.info("[profile] upsertProfile request", { userId: id, fields: Object.keys(patch) });

  const existing = await getProfile(id);
  if (existing) {
    console.info("[profile] upsertProfile updating existing row", { userId: id });
    return updateProfile(id, patch);
  }

  console.info("[profile] upsertProfile inserting new row", { userId: id });
  const { data, error } = await getSupabase()
    .from("profiles")
    .insert(profile)
    .select()
    .single();

  if (error) {
    logProfileError("upsertProfile insert failed", error, { userId: id });
    throw formatSupabaseError(error, "Failed to create profile");
  }

  return data as Profile;
}

export async function getProfileStats(userId: string): Promise<ProfileStats> {
  const { followers, following } = await getFollowCounts(userId);

  const [postsRes, eventsRes, workoutPostsRes] = await Promise.all([
    getSupabase()
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("author_id", userId),
    getSupabase()
      .from("event_attendees")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", userId),
    getSupabase()
      .from("posts")
      .select("created_at")
      .eq("author_id", userId)
      .in("post_type", ["workout_update", "photo", "video"]),
  ]);

  if (postsRes.error) {
    logProfileError("getProfileStats posts count failed", postsRes.error, { userId });
  }
  if (eventsRes.error) {
    logProfileError("getProfileStats events count failed", eventsRes.error, { userId });
  }
  if (workoutPostsRes.error) {
    logProfileError("getProfileStats workout posts failed", workoutPostsRes.error, { userId });
  }

  const workoutDates = workoutPostsRes.error
    ? []
    : (workoutPostsRes.data ?? []).map((post) => post.created_at as string);

  return {
    posts: postsRes.error ? 0 : postsRes.count ?? 0,
    followers,
    following,
    eventsJoined: eventsRes.error ? 0 : eventsRes.count ?? 0,
    workoutStreak: computeWorkoutStreakFromDates(workoutDates),
  };
}

export async function searchProfiles(query: string, limit = 30, viewerId?: string): Promise<Profile[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { data, error } = await getSupabase().rpc("search_profiles", {
    search_query: trimmed,
    result_limit: limit,
  });

  if (error) throw error;

  let profiles = (data ?? []) as Profile[];
  if (viewerId) {
    const blockedIds = new Set(await getBlockedIds(viewerId));
    profiles = profiles.filter((p) => p.id !== viewerId && !blockedIds.has(p.id));
  }
  return profiles;
}

export async function discoverProfiles(filters?: {
  activity?: string;
  goal?: string;
  city?: string;
}, viewerId?: string): Promise<Profile[]> {
  let q = getSupabase()
    .from("profiles")
    .select("*")
    .eq("onboarding_complete", true)
    .eq("visibility", "public")
    .limit(30);

  if (filters?.city) q = q.ilike("city", `%${filters.city}%`);
  if (filters?.activity) q = q.contains("activities", [filters.activity]);
  if (filters?.goal) q = q.contains("fitness_goals", [filters.goal]);

  const { data, error } = await q;
  if (error) throw error;

  let profiles = (data ?? []) as Profile[];
  if (viewerId) {
    const blockedIds = new Set(await getBlockedIds(viewerId));
    profiles = profiles.filter((p) => p.id !== viewerId && !blockedIds.has(p.id));
  }
  return profiles;
}

export async function updateProfile(userId: string, patch: Partial<Profile>) {
  console.info("[profile] updateProfile request", { userId, fields: Object.keys(patch) });

  // Presence is updated only via set_presence RPC.
  const { is_online: _io, last_seen_at: _ls, ...safePatch } = patch;

  const { data, error } = await getSupabase()
    .from("profiles")
    .update(safePatch)
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    logProfileError("updateProfile failed", error, { userId });
    throw formatSupabaseError(error, "Failed to update profile");
  }
  if (!data) throw new Error("Profile update did not return a row");

  return data as Profile;
}

export async function uploadAvatar(
  userId: string,
  uri: string,
  mimeType: string,
  file?: File | null
) {
  const ext = normalizeImageExt(mimeType);
  const path = `${userId}/avatar-${Date.now()}.${ext}`;
  const bytes = await readImageBytes(uri, file);
  const contentType = mimeType.startsWith("image/") ? mimeType : "image/jpeg";

  const { error: uploadError } = await getSupabase().storage
    .from("avatars")
    .upload(path, bytes, { contentType, upsert: false });

  if (uploadError) {
    throw formatSupabaseError(uploadError, "Avatar upload failed");
  }

  const { data: urlData } = getSupabase().storage.from("avatars").getPublicUrl(path);
  if (!urlData.publicUrl) {
    throw new Error("Avatar uploaded but public URL was not returned");
  }

  return urlData.publicUrl;
}

export async function uploadCoverImage(
  userId: string,
  uri: string,
  mimeType: string,
  file?: File | null
) {
  const ext = normalizeImageExt(mimeType);
  const path = `${userId}/cover-${Date.now()}.${ext}`;
  const bytes = await readImageBytes(uri, file);
  const contentType = mimeType.startsWith("image/") ? mimeType : "image/jpeg";

  const { error: uploadError } = await getSupabase().storage
    .from("avatars")
    .upload(path, bytes, { contentType, upsert: false });

  if (uploadError) {
    throw formatSupabaseError(uploadError, "Cover photo upload failed");
  }

  const { data: urlData } = getSupabase().storage.from("avatars").getPublicUrl(path);
  if (!urlData.publicUrl) {
    throw new Error("Cover uploaded but public URL was not returned");
  }

  return urlData.publicUrl;
}

export async function getProfilesByIds(ids: string[]): Promise<Profile[]> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (!uniqueIds.length) return [];

  const { data, error } = await getSupabase()
    .from("profiles")
    .select("*")
    .in("id", uniqueIds);

  if (error) throw error;
  return (data ?? []) as Profile[];
}
