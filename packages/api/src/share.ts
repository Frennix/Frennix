import type { Challenge, Group, Post } from "@frennix/types";
import { isGroupMember } from "./groups";
import { isChallengeParticipant } from "./challenges";
import { sendMessage } from "./messaging";
import { createPost, getPost } from "./posts";
import { getSupabase } from "./supabase";
import { formatSupabaseError } from "./profile-utils";

export async function getMyGroups(userId: string): Promise<Group[]> {
  const { data: memberships, error: memberError } = await getSupabase()
    .from("group_members")
    .select("group_id")
    .eq("user_id", userId);

  if (memberError) throw memberError;

  const groupIds = (memberships ?? []).map((m) => m.group_id);
  if (!groupIds.length) return [];

  const { data, error } = await getSupabase()
    .from("groups")
    .select("*")
    .in("id", groupIds)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Group[];
}

export async function getMyChallenges(userId: string): Promise<Challenge[]> {
  const { data: memberships, error: memberError } = await getSupabase()
    .from("challenge_participants")
    .select("challenge_id")
    .eq("user_id", userId)
    .eq("status", "active");

  if (memberError) throw memberError;

  const challengeIds = (memberships ?? []).map((m) => m.challenge_id);
  if (!challengeIds.length) return [];

  const { data, error } = await getSupabase()
    .from("challenges")
    .select("*")
    .in("id", challengeIds)
    .gte("end_date", new Date().toISOString())
    .order("end_date", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Challenge[];
}

async function assertPostShareable(postId: string, userId: string): Promise<Post> {
  const post = await getPost(postId, userId);
  if (!post) throw new Error("Post not found or not accessible");
  return post;
}

export async function sharePostToConversation(
  postId: string,
  conversationId: string,
  senderId: string
) {
  await assertPostShareable(postId, senderId);
  return sendMessage(conversationId, senderId, "Shared a post", null, postId);
}

export async function sharePostToGroup(postId: string, groupId: string, userId: string) {
  await assertPostShareable(postId, userId);

  const member = await isGroupMember(groupId, userId);
  if (!member) throw new Error("You must be a group member to share here");

  return createPost({
    author_id: userId,
    shared_post_id: postId,
    group_id: groupId,
    post_type: "text",
  });
}

export async function sharePostToChallenge(
  postId: string,
  challengeId: string,
  userId: string
) {
  await assertPostShareable(postId, userId);

  const participant = await isChallengeParticipant(challengeId, userId);
  if (!participant) throw new Error("You must join this challenge to share here");

  return createPost({
    author_id: userId,
    shared_post_id: postId,
    challenge_id: challengeId,
    post_type: "text",
  });
}

export async function getSharedPostsByIds(postIds: string[]): Promise<Map<string, Post>> {
  if (!postIds.length) return new Map();

  const uniqueIds = [...new Set(postIds)];
  const { data, error } = await getSupabase()
    .from("posts")
    .select(`*, author:profiles!posts_author_id_fkey(*)`)
    .in("id", uniqueIds);

  if (error) throw formatSupabaseError(error, "Failed to load shared posts");

  return new Map((data ?? []).map((p) => [p.id, p as Post]));
}
