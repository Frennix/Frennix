import type { BetaMetricsDashboard } from "@frennix/types";
import { formatSupabaseError } from "../profile-utils";
import { getSupabase } from "../supabase";

export async function getBetaMetricsDashboard(): Promise<BetaMetricsDashboard> {
  const { data, error } = await getSupabase().rpc("get_beta_metrics_dashboard");
  if (error) throw formatSupabaseError(error, "Failed to load beta metrics dashboard");
  return data as BetaMetricsDashboard;
}
