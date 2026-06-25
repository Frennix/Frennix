import type { Profile } from "@frennix/types";
import { getBlockedIds } from "./moderation";
import { getSupabase } from "./supabase";

export async function followUser(followerId: string, followingId: string) {
  if (followerId === followingId) {
    throw new Error("You cannot follow yourself");
  }

  const blockedIds = await getBlockedIds(followerId);
  if (blockedIds.includes(followingId)) {
    throw new Error("You cannot follow a blocked user");
  }

  const { error } = await getSupabase()
    .from("follows")
    .insert({ follower_id: followerId, following_id: followingId });

  if (error) throw error;
}

export async function unfollowUser(followerId: string, followingId: string) {
  const { error } = await getSupabase()
    .from("follows")
    .delete()
    .eq("follower_id", followerId)
    .eq("following_id", followingId);

  if (error) throw error;
}

export async function isFollowing(followerId: string, followingId: string) {
  const { data, error } = await getSupabase()
    .from("follows")
    .select("follower_id")
    .eq("follower_id", followerId)
    .eq("following_id", followingId)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

export async function getFollowingIds(followerId: string): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from("follows")
    .select("following_id")
    .eq("follower_id", followerId);

  if (error) throw error;
  return (data ?? []).map((row) => row.following_id as string);
}

function extractProfile(value: unknown): Profile | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Profile;
}

export async function getFollowers(userId: string): Promise<Profile[]> {
  const { data, error } = await getSupabase()
    .from("follows")
    .select(`follower:profiles!follows_follower_id_fkey(*)`)
    .eq("following_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? [])
    .map((row) => extractProfile((row as { follower: unknown }).follower))
    .filter((profile): profile is Profile => Boolean(profile));
}

export async function getFollowing(userId: string): Promise<Profile[]> {
  const { data, error } = await getSupabase()
    .from("follows")
    .select(`following:profiles!follows_following_id_fkey(*)`)
    .eq("follower_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? [])
    .map((row) => extractProfile((row as { following: unknown }).following))
    .filter((profile): profile is Profile => Boolean(profile));
}

export async function getFollowCounts(userId: string) {
  const [followersRes, followingRes] = await Promise.all([
    getSupabase()
      .from("follows")
      .select("follower_id", { count: "exact", head: true })
      .eq("following_id", userId),
    getSupabase()
      .from("follows")
      .select("following_id", { count: "exact", head: true })
      .eq("follower_id", userId),
  ]);

  if (followersRes.error) throw followersRes.error;
  if (followingRes.error) throw followingRes.error;

  return {
    followers: followersRes.count ?? 0,
    following: followingRes.count ?? 0,
  };
}
