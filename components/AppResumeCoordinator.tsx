import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { attachAppResumeRefetch } from "@/lib/app-resume";

/** Mount once near the app root to refresh stale data after tab/app resume. */
export function AppResumeCoordinator() {
  const queryClient = useQueryClient();

  useEffect(() => attachAppResumeRefetch(queryClient), [queryClient]);

  return null;
}
