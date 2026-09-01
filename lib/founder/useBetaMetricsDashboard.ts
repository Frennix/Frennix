import { useQuery } from "@tanstack/react-query";
import { getBetaMetricsDashboard } from "@frennix/api";

export function useBetaMetricsDashboard() {
  return useQuery({
    queryKey: ["founder-beta-metrics-dashboard"],
    queryFn: getBetaMetricsDashboard,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
