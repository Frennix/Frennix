import type { ExecutiveDashboard } from "@frennix/types";
import { formatSupabaseError } from "../profile-utils";
import { getSupabase } from "../supabase";

export async function getExecutiveDashboard(
  environment = "production",
  date?: string
): Promise<ExecutiveDashboard> {
  const { data, error } = await getSupabase().rpc("get_executive_dashboard", {
    p_environment: environment,
    p_date: date ?? new Date().toISOString().slice(0, 10),
  });
  if (error) throw formatSupabaseError(error, "Failed to load executive dashboard");
  return data as ExecutiveDashboard;
}

export async function getFounderAnalyticsDomains() {
  const { data, error } = await getSupabase().rpc("get_founder_analytics_domains");
  if (error) throw formatSupabaseError(error, "Failed to load analytics domains");
  return (data ?? []) as import("@frennix/types").AnalyticsDomain[];
}
