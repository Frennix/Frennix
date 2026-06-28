import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  exportFounderActivityFeed,
  getFounderActivityFeed,
  subscribeToFounderActivity,
  type ActivityFeedQuery,
} from "@frennix/api";
import type { ActivityCategory, FounderActivityEvent, FounderDatePreset } from "@frennix/types";
import { useAuth } from "@/providers/AuthProvider";
import { FOUNDER_DEFAULT_PAGE_SIZE } from "@/lib/founder/types";
import { dateRangeForPreset } from "@/lib/founder/utils";

export type ActivityFeedState = {
  preset: FounderDatePreset;
  category: ActivityCategory;
  search: string;
  sortDir: "asc" | "desc";
  page: number;
  pageSize: number;
};

export function useFounderActivityFeed(initial?: Partial<ActivityFeedState>) {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();

  const [state, setState] = useState<ActivityFeedState>({
    preset: initial?.preset ?? "today",
    category: initial?.category ?? "all",
    search: initial?.search ?? "",
    sortDir: initial?.sortDir ?? "desc",
    page: initial?.page ?? 1,
    pageSize: initial?.pageSize ?? FOUNDER_DEFAULT_PAGE_SIZE,
  });

  const range = useMemo(() => dateRangeForPreset(state.preset), [state.preset]);

  const queryKey = useMemo(
    () => ["founder-activity", userId, state, range] as const,
    [userId, state, range]
  );

  const query = useQuery({
    queryKey,
    queryFn: () =>
      getFounderActivityFeed({
        since: range.since,
        until: range.until,
        category: state.category,
        search: state.search || undefined,
        sortDir: state.sortDir,
        page: state.page,
        pageSize: state.pageSize,
      }),
    enabled: !!userId,
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });

  const prependRealtimeEvent = useCallback(
    (event: FounderActivityEvent) => {
      queryClient.setQueryData(queryKey, (current: typeof query.data) => {
        if (!current) return current;
        if (current.items.some((item) => item.id === event.id)) return current;
        if (state.category !== "all" && event.category !== state.category) return current;
        return {
          ...current,
          items: [event, ...current.items].slice(0, state.pageSize),
          total: current.total + 1,
        };
      });
    },
    [queryClient, queryKey, state.category, state.pageSize]
  );

  useEffect(() => {
    if (!userId) return;

    const sub = subscribeToFounderActivity(prependRealtimeEvent);
    return () => sub.unsubscribe();
  }, [userId, prependRealtimeEvent]);

  const exportFeed = useCallback(
    async (format: "csv" | "json") => {
      const rows = await exportFounderActivityFeed({
        since: range.since,
        until: range.until,
        category: state.category,
        search: state.search || undefined,
      });
      return { rows, format };
    },
    [range, state.category, state.search]
  );

  return {
    ...query,
    state,
    setState,
    exportFeed,
    range,
  };
}
