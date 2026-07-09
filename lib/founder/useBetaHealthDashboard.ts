import { useQuery } from "@tanstack/react-query";
import { getBetaHealthDashboard } from "@frennix/api";
import type { FounderDatePreset } from "@frennix/types";

export function useBetaHealthDashboard(preset: FounderDatePreset = "week") {
  return useQuery({
    queryKey: ["founder-beta-health-dashboard", preset],
    queryFn: () => getBetaHealthDashboard(preset),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
