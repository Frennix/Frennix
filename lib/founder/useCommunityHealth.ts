import { useQuery } from "@tanstack/react-query";
import { getCommunityHealth } from "@frennix/api";

export function useCommunityHealth(days = 30) {
  return useQuery({
    queryKey: ["founder-community-health", days],
    queryFn: () => getCommunityHealth(days),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
