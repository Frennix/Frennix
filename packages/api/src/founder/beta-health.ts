import type { BetaHealthDashboard, FounderDatePreset } from "@frennix/types";
import { formatSupabaseError } from "../profile-utils";
import { getSupabase } from "../supabase";

export function betaHealthPresetParam(preset: FounderDatePreset): string {
  switch (preset) {
    case "today":
    case "15m":
      return "today";
    case "week":
      return "week";
    case "month":
      return "month";
    case "all":
      return "all";
    default:
      return "week";
  }
}

export async function getBetaHealthDashboard(
  preset: FounderDatePreset = "week"
): Promise<BetaHealthDashboard> {
  const { data, error } = await getSupabase().rpc("get_beta_health_dashboard", {
    p_preset: betaHealthPresetParam(preset),
  });
  if (error) throw formatSupabaseError(error, "Failed to load beta health dashboard");
  return data as BetaHealthDashboard;
}
