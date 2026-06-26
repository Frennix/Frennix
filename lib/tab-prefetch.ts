import type { QueryClient } from "@tanstack/react-query";
import {
  getChallenges,
  getConversations,
  getGroups,
  getProfileStats,
  getSuggestedAthletes,
  getWorkoutEvents,
} from "@frennix/api";

const TAB_STALE_MS = 120_000;

/** Warm caches for non-Feed tabs after the app settles — instant tab switches without refetch storms. */
export async function prefetchTabData(queryClient: QueryClient, userId: string) {
  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: ["discover-suggestions", userId],
      queryFn: () => getSuggestedAthletes(userId, 20),
      staleTime: TAB_STALE_MS,
    }),
    queryClient.prefetchQuery({
      queryKey: ["discover-groups", ""],
      queryFn: () => getGroups({}),
      staleTime: TAB_STALE_MS,
    }),
    queryClient.prefetchQuery({
      queryKey: ["discover-challenges"],
      queryFn: getChallenges,
      staleTime: TAB_STALE_MS,
    }),
    queryClient.prefetchQuery({
      queryKey: ["workout-events", userId],
      queryFn: () => getWorkoutEvents(userId),
      staleTime: TAB_STALE_MS,
    }),
    queryClient.prefetchQuery({
      queryKey: ["conversations", userId],
      queryFn: () => getConversations(userId),
      staleTime: 60_000,
    }),
    queryClient.prefetchQuery({
      queryKey: ["profile-stats", userId],
      queryFn: () => getProfileStats(userId),
      staleTime: TAB_STALE_MS,
    }),
  ]);
}
