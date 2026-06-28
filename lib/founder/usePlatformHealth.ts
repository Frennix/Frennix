import { useQuery } from "@tanstack/react-query";
import { getPlatformHealth } from "@frennix/api";

export function usePlatformHealth() {
  return useQuery({
    queryKey: ["founder-platform-health"],
    queryFn: getPlatformHealth,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}
