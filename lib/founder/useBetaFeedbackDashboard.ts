import { useQuery } from "@tanstack/react-query";
import { getBetaFeedbackDashboard, listBetaFeedback } from "@frennix/api";
import type { BetaFeedbackListParams } from "@frennix/types";

export function useBetaFeedbackDashboard(days = 30) {
  return useQuery({
    queryKey: ["founder-beta-feedback-dashboard", days],
    queryFn: () => getBetaFeedbackDashboard(days),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function useBetaFeedbackList(params: BetaFeedbackListParams) {
  return useQuery({
    queryKey: ["founder-beta-feedback-list", params],
    queryFn: () => listBetaFeedback(params),
    staleTime: 30_000,
  });
}
