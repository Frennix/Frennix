import { useQuery } from "@tanstack/react-query";
import { getMatchmakingAnalytics } from "@frennix/api";

export function useMatchmakingAnalytics(days = 30) {
  return useQuery({
    queryKey: ["founder-matchmaking-analytics", days],
    queryFn: () => getMatchmakingAnalytics(days),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
