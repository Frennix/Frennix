import type { Group, GroupMember, Post } from "@frennix/types";
import { enrichPostsWithInteractions } from "./posts";
import { getSupabase } from "./supabase";

export async function getGroups(filters?: { sport?: string; query?: string }): Promise<Group[]> {
  let q = getSupabase()
    .from("groups")
    .select("*")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(30);

  if (filters?.query) q = q.ilike("name", `%${filters.query}%`);
  if (filters?.sport) q = q.contains("sport_tags", [filters.sport]);

  const { data, error } = await q;
  if (error) throw error;

  const groups = (data ?? []) as Group[];
  const withCounts = await Promise.all(
    groups.map(async (g) => {
      const { count } = await getSupabase()
        .from("group_members")
        .select("*", { count: "exact", head: true })
        .eq("group_id", g.id);
      return { ...g, member_count: count ?? 0 };
    })
  );
  return withCounts;
}

export async function getGroup(groupId: string): Promise<Group | null> {
  const { data, error } = await getSupabase().from("groups").select("*").eq("id", groupId).single();
  if (error) throw error;
  const { count } = await getSupabase()
    .from("group_members")
    .select("*", { count: "exact", head: true })
    .eq("group_id", groupId);
  return { ...(data as Group), member_count: count ?? 0 };
}

export async function createGroup(input: {
  name: string;
  description?: string;
  sport_tags: string[];
  owner_id: string;
  is_public?: boolean;
}) {
  const { data, error } = await getSupabase()
    .from("groups")
    .insert({ ...input, is_public: input.is_public ?? true })
    .select()
    .single();
  if (error) throw error;

  await getSupabase().from("group_members").insert({
    group_id: data.id,
    user_id: input.owner_id,
    role: "owner",
  });

  return data as Group;
}

export async function joinGroup(groupId: string, userId: string) {
  const { error } = await getSupabase().from("group_members").insert({
    group_id: groupId,
    user_id: userId,
    role: "member",
  });
  if (error) throw error;
}

export async function leaveGroup(groupId: string, userId: string) {
  const { error } = await getSupabase()
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await getSupabase()
    .from("group_members")
    .select(`*, profile:profiles(*)`)
    .eq("group_id", groupId);
  if (error) throw error;
  return (data ?? []) as GroupMember[];
}

export async function getGroupPosts(groupId: string, viewerId?: string) {
  const { data, error } = await getSupabase()
    .from("posts")
    .select(`*, author:profiles!posts_author_id_fkey(*)`)
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const posts = (data ?? []) as Post[];
  if (viewerId) return enrichPostsWithInteractions(posts, viewerId);
  return posts;
}

export async function isGroupMember(groupId: string, userId: string) {
  const { data } = await getSupabase()
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}
