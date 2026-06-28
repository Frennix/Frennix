import type {
  ActivityCategory,
  FounderActivityEvent,
  FounderPaginatedResult,
} from "@frennix/types";
import { subscribePostgresChanges, type RealtimeSubscription } from "../realtime-utils";
import { formatSupabaseError } from "../profile-utils";
import { getSupabase } from "../supabase";

export type ActivityFeedQuery = {
  since: string;
  until?: string;
  category?: ActivityCategory;
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  environment?: string;
};

export async function getFounderActivityFeed(
  query: ActivityFeedQuery
): Promise<FounderPaginatedResult<FounderActivityEvent>> {
  const { data, error } = await getSupabase().rpc("get_founder_activity_feed", {
    p_since: query.since,
    p_until: query.until ?? new Date().toISOString(),
    p_category: query.category && query.category !== "all" ? query.category : null,
    p_search: query.search ?? null,
    p_sort_by: query.sortBy ?? "created_at",
    p_sort_dir: query.sortDir ?? "desc",
    p_page: query.page ?? 1,
    p_page_size: query.pageSize ?? 25,
    p_environment: query.environment ?? "production",
  });

  if (error) throw formatSupabaseError(error, "Failed to load activity feed");

  const payload = data as FounderPaginatedResult<FounderActivityEvent>;
  return {
    items: payload.items ?? [],
    total: payload.total ?? 0,
    page: payload.page ?? 1,
    pageSize: payload.pageSize ?? 25,
    hasMore: payload.hasMore ?? false,
  };
}

export async function exportFounderActivityFeed(
  query: Omit<ActivityFeedQuery, "page" | "pageSize"> & { limit?: number }
): Promise<FounderActivityEvent[]> {
  const { data, error } = await getSupabase().rpc("export_founder_activity_feed", {
    p_since: query.since,
    p_until: query.until ?? new Date().toISOString(),
    p_category: query.category && query.category !== "all" ? query.category : null,
    p_search: query.search ?? null,
    p_environment: query.environment ?? "production",
    p_limit: query.limit ?? 5000,
  });

  if (error) throw formatSupabaseError(error, "Failed to export activity feed");
  return (data ?? []) as FounderActivityEvent[];
}

export type FounderActivitySubscription = RealtimeSubscription & { ok: boolean };

export function subscribeToFounderActivity(
  onInsert: (event: FounderActivityEvent) => void
): FounderActivitySubscription {
  const subscription = subscribePostgresChanges("founder-activity", "feed", [
    {
      config: { event: "INSERT", schema: "public", table: "founder_activity_events" },
      callback: (payload) => {
        const row = (payload as { new?: FounderActivityEvent }).new;
        if (row?.id) onInsert(row);
      },
    },
  ]);

  return { ...subscription, ok: subscription.channel != null };
}
