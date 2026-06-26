import type { QueryClient } from "@tanstack/react-query";
import {
  getChallenges,
  getConversations,
  getFollowingIds,
  getGroups,
  getPostsByUser,
  getProfileStats,
  getSuggestedAthletes,
  getWorkoutEvents,
} from "@frennix/api";

const TAB_STALE_MS = 120_000;
const TAB_GC_MS = 30 * 60 * 1000;

/** Warm caches for non-Feed tabs after the app settles — instant tab switches without refetch storms. */
export async function prefetchTabData(queryClient: QueryClient, userId: string) {
  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: ["discover-suggestions", userId],
      queryFn: () => getSuggestedAthletes(userId, 20),
      staleTime: TAB_STALE_MS,
      gcTime: TAB_GC_MS,
    }),
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
      queryKey: ["conversations", userId],
      queryFn: () => getConversations(userId),
      staleTime: 60_000,
      gcTime: TAB_GC_MS,
    }),
    queryClient.prefetchQuery({
      queryKey: ["profile-stats", userId],
      queryFn: () => getProfileStats(userId),
      staleTime: TAB_STALE_MS,
      gcTime: TAB_GC_MS,
    }),
    queryClient.prefetchQuery({
      queryKey: ["following-ids", userId],
      queryFn: () => getFollowingIds(userId),
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
