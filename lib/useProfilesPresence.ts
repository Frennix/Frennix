import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { subscribeToProfilesPresence } from "@frennix/api";
import { applyProfilePresenceToCaches } from "@/lib/presence-cache";

export function useProfilesPresence(userId: string, profileIds: string[]) {
  const queryClient = useQueryClient();

  const idsKey = useMemo(
    () => [...new Set(profileIds.filter(Boolean))].sort().join(","),
    [profileIds]
  );

  useEffect(() => {
    if (!userId || !idsKey) return;

    const ids = idsKey.split(",");
    const subscription = subscribeToProfilesPresence(ids, (update) => {
      applyProfilePresenceToCaches(queryClient, userId, update);
    });

    return () => subscription.unsubscribe();
  }, [idsKey, queryClient, userId]);
}
