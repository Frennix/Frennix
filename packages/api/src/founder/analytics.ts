import type { MatchmakingAnalyticsDashboard } from "@frennix/types";
import { formatSupabaseError } from "../profile-utils";
import { getSupabase } from "../supabase";

export async function getMatchmakingAnalytics(days = 30): Promise<MatchmakingAnalyticsDashboard> {
  const { data, error } = await getSupabase().rpc("get_matchmaking_analytics", {
    p_days: days,
  });
  if (error) throw formatSupabaseError(error, "Failed to load matchmaking analytics");
  return data as MatchmakingAnalyticsDashboard;
}
