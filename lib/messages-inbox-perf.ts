type InboxPerfDetails = Record<string, number | string | boolean | undefined>;

export function logInboxPerf(label: string, startedAt: number, details: InboxPerfDetails = {}) {
  if (typeof __DEV__ === "undefined" || !__DEV__) return;
  console.info(`[messaging-perf] ${label}`, {
    durationMs: Math.round(performance.now() - startedAt),
    ...details,
  });
}

export function markInboxVisible(userId: string, conversationCount: number, source: "cache" | "network") {
  if (typeof __DEV__ === "undefined" || !__DEV__) return;
  console.info("[messaging-perf] inbox-visible", {
    userId: userId.slice(0, 8),
    conversationCount,
    source,
  });
}
