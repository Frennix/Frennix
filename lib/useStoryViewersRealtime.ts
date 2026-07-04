import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { subscribeStoryViewers } from "@frennix/api";

/** Refetch story viewers when new views arrive in realtime. */
export function useStoryViewersRealtime(
  storyOwnerId: string | null | undefined,
  storyId: string | null | undefined,
  enabled: boolean
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !storyOwnerId || !storyId) return;

    const { unsubscribe } = subscribeStoryViewers(storyId, () => {
      void queryClient.invalidateQueries({ queryKey: ["story-viewers", storyOwnerId, storyId] });
      void queryClient.invalidateQueries({ queryKey: ["story-analytics", storyId] });
      void queryClient.invalidateQueries({ queryKey: ["story-insights", storyOwnerId, storyId] });
    });

    return unsubscribe;
  }, [enabled, queryClient, storyId, storyOwnerId]);
}
