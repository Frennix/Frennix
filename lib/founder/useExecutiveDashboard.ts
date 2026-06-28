import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getExecutiveDashboard } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";

export function useExecutiveDashboard(environment = "production") {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const date = new Date().toISOString().slice(0, 10);

  return useQuery({
    queryKey: ["founder-executive", userId, environment, date],
    queryFn: () => getExecutiveDashboard(environment, date),
    enabled: !!userId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useInvalidateExecutiveDashboard() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["founder-executive"] });
}
