import type { Challenge, Post } from "@frennix/types";
import { enrichPostsWithInteractions } from "./posts";
import { getSupabase } from "./supabase";

export async function getChallenges(): Promise<Challenge[]> {
  const { data, error } = await getSupabase()
    .from("challenges")
    .select("*")
    .gte("end_date", new Date().toISOString())
    .order("start_date", { ascending: true })
    .limit(30);
  if (error) throw error;

  return Promise.all(
    ((data ?? []) as Challenge[]).map(async (c) => {
      const { count } = await getSupabase()
        .from("challenge_participants")
        .select("*", { count: "exact", head: true })
        .eq("challenge_id", c.id);
      return { ...c, participant_count: count ?? 0 };
    })
  );
}

export async function getChallenge(id: string): Promise<Challenge | null> {
  const { data, error } = await getSupabase().from("challenges").select("*").eq("id", id).single();
  if (error) throw error;
  const { count } = await getSupabase()
    .from("challenge_participants")
    .select("*", { count: "exact", head: true })
    .eq("challenge_id", id);
  return { ...(data as Challenge), participant_count: count ?? 0 };
}

export async function createChallenge(input: {
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  created_by: string;
  group_id?: string | null;
}) {
  const { data, error } = await getSupabase().from("challenges").insert(input).select().single();
  if (error) throw error;
  return data as Challenge;
}

export async function joinChallenge(challengeId: string, userId: string) {
  const { error } = await getSupabase().from("challenge_participants").insert({
    challenge_id: challengeId,
    user_id: userId,
    status: "active",
  });
  if (error) throw error;
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
