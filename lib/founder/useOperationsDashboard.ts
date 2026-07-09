import { useQuery } from "@tanstack/react-query";
import { getOperationsDashboard } from "@frennix/api";
import type { FounderDatePreset, OperationsTrendWindow } from "@frennix/types";

export function useOperationsDashboard(
  trendWindow: OperationsTrendWindow = "7d",
  preset: FounderDatePreset = "today"
) {
  return useQuery({
    queryKey: ["founder-operations-dashboard", trendWindow, preset],
    queryFn: () => getOperationsDashboard(trendWindow, preset),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}
