import type { ProductAnalyticsSummary } from "@frennix/types";
import { formatSupabaseError } from "./profile-utils";
import { getSupabase } from "./supabase";

export async function trackProductEvent(
  eventName: string,
  properties: Record<string, unknown> = {},
  context?: { appVersion?: string; platform?: string }
): Promise<void> {
  const { error } = await getSupabase().rpc("track_product_event", {
    p_event_name: eventName,
    p_properties: properties,
    p_app_version: context?.appVersion ?? null,
    p_platform: context?.platform ?? null,
  });

  if (error) {
    console.warn("[analytics] track_product_event failed", error.message);
  }
}

export async function trackDailyActiveUser(context?: {
  appVersion?: string;
  platform?: string;
}): Promise<void> {
  const { error } = await getSupabase().rpc("track_daily_active_user", {
    p_app_version: context?.appVersion ?? null,
    p_platform: context?.platform ?? null,
  });

  if (error) {
    console.warn("[analytics] track_daily_active_user failed", error.message);
  }
}

export async function getProductAnalyticsSummary(
  days = 7
): Promise<ProductAnalyticsSummary> {
  const { data, error } = await getSupabase().rpc("get_product_analytics_summary", {
    p_days: days,
  });

  if (error) throw formatSupabaseError(error, "Failed to load analytics summary");
  return data as ProductAnalyticsSummary;
}
