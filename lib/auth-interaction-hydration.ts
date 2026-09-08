import type { QueryClient } from "@tanstack/react-query";
import { clearFeedCache } from "./feed-cache";

/** Drop in-memory interaction caches so a later login cannot reuse another session. */
export function resetInteractionQueriesOnLogout(queryClient: QueryClient, userId: string) {
  queryClient.removeQueries({ queryKey: ["feed"] });
  queryClient.removeQueries({ queryKey: ["comments"] });
  queryClient.removeQueries({ queryKey: ["post"] });
  if (userId) {
    void clearFeedCache(userId);
  }
}

/** Force feed/comment/post queries to refetch viewer likes from the database. */
export function invalidateInteractionQueriesOnLogin(queryClient: QueryClient, userId: string) {
  if (!userId) return;
  void queryClient.invalidateQueries({ queryKey: ["feed", userId] });
  void queryClient.invalidateQueries({ queryKey: ["comments"] });
  void queryClient.invalidateQueries({ queryKey: ["post"] });
}
