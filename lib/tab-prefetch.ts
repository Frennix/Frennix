import type { QueryClient } from "@tanstack/react-query";
import {
  getChallenges,
  getConversations,
  getGroups,
  getPostsByUser,
  getProfileStats,
  getCalendarView,
  getWorkoutEvents,
} from "@frennix/api";
import { hydrateMessagesInboxCache, writeMessagesInboxCache } from "@/lib/messages-inbox-cache";
import { getCalendarViewQueryKey, getDefaultCalendarRange } from "@/lib/calendar-query-range";

const TAB_STALE_MS = 120_000;
const TAB_GC_MS = 30 * 60 * 1000;

/** Warm caches for non-Feed tabs after the app settles — instant tab switches without refetch storms. */
export async function prefetchTabData(queryClient: QueryClient, userId: string) {
  await hydrateMessagesInboxCache(queryClient, userId);

  await queryClient.prefetchQuery({
    queryKey: ["conversations", userId],
    queryFn: async () => {
      const conversations = await getConversations(userId);
      void writeMessagesInboxCache(userId, conversations);
      return conversations;
    },
    staleTime: 60_000,
    gcTime: TAB_GC_MS,
  });

  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: ["discover-groups", ""],
      queryFn: () => getGroups({}),
      staleTime: TAB_STALE_MS,
      gcTime: TAB_GC_MS,
    }),
    queryClient.prefetchQuery({
      queryKey: ["discover-challenges"],
      queryFn: getChallenges,
      staleTime: TAB_STALE_MS,
      gcTime: TAB_GC_MS,
    }),
    queryClient.prefetchQuery({
      queryKey: ["workout-events", userId],
      queryFn: () => getWorkoutEvents(userId),
      staleTime: TAB_STALE_MS,
      gcTime: TAB_GC_MS,
    }),
    queryClient.prefetchQuery({
      queryKey: (() => {
        const { rangeStart, rangeEnd } = getDefaultCalendarRange();
        return getCalendarViewQueryKey(userId, rangeStart, rangeEnd);
      })(),
      queryFn: () => {
        const { rangeStart, rangeEnd } = getDefaultCalendarRange();
        return getCalendarView(userId, rangeStart, rangeEnd);
      },
      staleTime: TAB_STALE_MS,
      gcTime: TAB_GC_MS,
    }),
    queryClient.prefetchQuery({
      queryKey: ["profile-stats", userId],
      queryFn: () => getProfileStats(userId),
      staleTime: TAB_STALE_MS,
      gcTime: TAB_GC_MS,
    }),
    queryClient.prefetchQuery({
      queryKey: ["user-posts", userId, userId],
      queryFn: () => getPostsByUser(userId, userId),
      staleTime: TAB_STALE_MS,
      gcTime: TAB_GC_MS,
    }),
  ]);
}
