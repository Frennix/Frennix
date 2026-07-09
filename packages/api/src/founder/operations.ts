import type { FounderDatePreset, OperationsDashboard, OperationsTrendWindow } from "@frennix/types";
import { betaHealthPresetParam } from "./beta-health";
import { formatSupabaseError } from "../profile-utils";
import { getSupabase } from "../supabase";

export async function getOperationsDashboard(
  trendWindow: OperationsTrendWindow = "7d",
  preset: FounderDatePreset = "today"
): Promise<OperationsDashboard> {
  const { data, error } = await getSupabase().rpc("get_operations_dashboard", {
    p_trend_window: trendWindow,
    p_preset: betaHealthPresetParam(preset),
  });
  if (error) throw formatSupabaseError(error, "Failed to load operations dashboard");
  return data as OperationsDashboard;
}

export async function resolveOperationsAlert(alertId: string): Promise<void> {
  const { error } = await getSupabase().rpc("resolve_operations_alert", {
    p_alert_id: alertId,
  });
  if (error) throw formatSupabaseError(error, "Failed to resolve alert");
}

export async function clearResolvedOperationsAlerts(): Promise<number> {
  const { data, error } = await getSupabase().rpc("clear_resolved_operations_alerts");
  if (error) throw formatSupabaseError(error, "Failed to clear resolved alerts");
  return (data as number) ?? 0;
}
