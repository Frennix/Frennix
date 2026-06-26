import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { InteractionManager } from "react-native";
import { useAuth } from "@/providers/AuthProvider";
import { prefetchTabData } from "@/lib/tab-prefetch";

/** Prefetch sibling tab data after Feed interactions finish — keeps tab taps instant. */
export function TabPrefetchCoordinator() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const task = InteractionManager.runAfterInteractions(() => {
      void prefetchTabData(queryClient, userId);
    });

    return () => task.cancel();
  }, [queryClient, userId]);

  return null;
}
