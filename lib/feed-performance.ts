import { trackFeedLoad } from "@/lib/product-analytics";

type FeedPerfSession = {
  userId: string;
  startedAt: number;
  marks: Record<string, number>;
  cacheHydrated: boolean;
  reported: boolean;
};

let activeSession: FeedPerfSession | null = null;

function now() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function startFeedPerfSession(userId: string) {
  activeSession = {
    userId,
    startedAt: now(),
    marks: { session_start: now() },
    cacheHydrated: false,
    reported: false,
  };
  console.info("[feed-perf] session_start", { userId: userId.slice(0, 8) });
}

export function markFeedPerf(label: string, extra?: Record<string, unknown>) {
  if (!activeSession) return;
  const ts = now();
  activeSession.marks[label] = ts;
  const sinceStart = Math.round(ts - activeSession.startedAt);
  console.info(`[feed-perf] ${label}`, { since_start_ms: sinceStart, ...extra });
}

export function markFeedCacheHydrated(postCount: number) {
  if (!activeSession) return;
  activeSession.cacheHydrated = true;
  markFeedPerf("cache_hydrated", { post_count: postCount });
}

export function reportFeedPerfReady(postCount: number) {
  if (!activeSession || activeSession.reported) return;
  activeSession.reported = true;

  const durationMs = now() - activeSession.startedAt;
  trackFeedLoad(durationMs, postCount);
  console.info("[feed-perf] feed_ready", {
    duration_ms: Math.round(durationMs),
    post_count: postCount,
    cache_hydrated: activeSession.cacheHydrated,
    marks: Object.fromEntries(
      Object.entries(activeSession.marks).map(([key, value]) => [
        key,
        Math.round(value - activeSession!.startedAt),
      ])
    ),
  });
}

export function resetFeedPerfSession() {
  activeSession = null;
}
