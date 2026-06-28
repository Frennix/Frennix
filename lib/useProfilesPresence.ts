import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { subscribeToProfilesPresence } from "@frennix/api";
import { applyProfilePresenceToCaches } from "@/lib/presence-cache";

export function useProfilesPresence(userId: string, profileIds: string[]) {
  const queryClient = useQueryClient();
  const [realtimeUnavailable, setRealtimeUnavailable] = useState(false);

  const idsKey = useMemo(
    () => [...new Set(profileIds.filter(Boolean))].sort().join(","),
    [profileIds]
  );

  useEffect(() => {
    if (!userId || !idsKey) {
      setRealtimeUnavailable(false);
      return;
    }

    setRealtimeUnavailable(false);
    const ids = idsKey.split(",");

    let subscription: ReturnType<typeof subscribeToProfilesPresence> | null = null;

    try {
      subscription = subscribeToProfilesPresence(ids, (update) => {
        applyProfilePresenceToCaches(queryClient, userId, update);
      });

      if (!subscription.ok) {
        setRealtimeUnavailable(true);
      }
    } catch (error) {
      console.warn("[presence] subscription failed", error);
      setRealtimeUnavailable(true);
    }

    return () => {
      subscription?.unsubscribe();
    };
  }, [idsKey, queryClient, userId]);

  return { realtimeUnavailable };
}
