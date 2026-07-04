import type { UserReputationScore } from "@frennix/types";
import { getSupabase } from "./supabase";

/**
 * Read reputation scores for a user.
 * Not exposed in UI yet — for internal/admin/future profile use.
 */
export async function getUserReputationScore(
  userId: string
): Promise<UserReputationScore | null> {
  const { data, error } = await getSupabase()
    .from("user_reputation_scores")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return data as UserReputationScore;
}

/** Force reputation refresh from activity ledger (normally automatic via trigger). */
export async function refreshUserReputation(userId: string): Promise<void> {
  const { error } = await getSupabase().rpc("refresh_user_reputation", {
    p_user_id: userId,
  });

  if (error) throw error;
}
