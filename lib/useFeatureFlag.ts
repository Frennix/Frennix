import { useQuery } from "@tanstack/react-query";
import { evaluateFeatureFlag } from "@frennix/api";

export function useFeatureFlag(flagKey: string, defaultEnabled = true) {
  const query = useQuery({
    queryKey: ["feature-flag", flagKey],
    queryFn: () => evaluateFeatureFlag(flagKey),
    staleTime: 60_000,
  });

  return {
    enabled: query.data ?? defaultEnabled,
    isLoading: query.isLoading,
  };
}
