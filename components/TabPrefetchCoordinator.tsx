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

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const task = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(() => {
        if (!cancelled) void prefetchTabData(queryClient, userId);
      }, 3_000);
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      task.cancel();
    };
  }, [queryClient, userId]);

  return null;
}
