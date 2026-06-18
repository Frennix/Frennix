import type { QueryClient } from "@tanstack/react-query";
import { AppState, Platform } from "react-native";

/** Queries that are safe to refresh on tab resume (lightweight; skip heavy feed/notifications). */
const RESUME_REFETCH_QUERY_ROOTS = new Set([
  "unread-notifications",
  "unread-messages",
  "feed-stories",
]);

/** Minimum time hidden before we treat the next show as a resume (ms). */
const RESUME_HIDDEN_MS = 2_000;

/** Debounce before refetching stale queries after resume (ms). */
const RESUME_REFETCH_DELAY_MS = 600;

let hiddenAt: number | null = null;
let resumeTimer: ReturnType<typeof setTimeout> | null = null;

function clearResumeTimer() {
  if (resumeTimer) {
    clearTimeout(resumeTimer);
    resumeTimer = null;
  }
}

function refetchStaleActiveQueries(queryClient: QueryClient) {
  void queryClient.refetchQueries({
    type: "active",
    stale: true,
    predicate: (query) => {
      const root = query.queryKey[0];
      return typeof root === "string" && RESUME_REFETCH_QUERY_ROOTS.has(root);
    },
  });
}

function scheduleResumeRefetch(queryClient: QueryClient) {
  clearResumeTimer();
  resumeTimer = setTimeout(() => {
    resumeTimer = null;
    refetchStaleActiveQueries(queryClient);
  }, RESUME_REFETCH_DELAY_MS);
}

function onAppVisible(queryClient: QueryClient) {
  const wasHiddenLongEnough =
    hiddenAt !== null && Date.now() - hiddenAt >= RESUME_HIDDEN_MS;
  hiddenAt = null;

  if (wasHiddenLongEnough) {
    scheduleResumeRefetch(queryClient);
  }
}

function onAppHidden() {
  hiddenAt = Date.now();
  clearResumeTimer();
}

/** Debounced stale-query refresh when the app returns from background or a hidden tab. */
export function attachAppResumeRefetch(queryClient: QueryClient): () => void {
  if (Platform.OS === "web" && typeof document !== "undefined") {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        onAppVisible(queryClient);
      } else {
        onAppHidden();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearResumeTimer();
    };
  }

  const subscription = AppState.addEventListener("change", (nextState) => {
    if (nextState === "active") {
      onAppVisible(queryClient);
    } else if (nextState === "background" || nextState === "inactive") {
      onAppHidden();
    }
  });

  return () => {
    subscription.remove();
    clearResumeTimer();
  };
}
