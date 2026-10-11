const bootMs = typeof performance !== "undefined" ? performance.now() : Date.now();

function devPerformanceEnabled(): boolean {
  return typeof __DEV__ !== "undefined" && __DEV__;
}

/** Development timings for startup, auth, and Home readiness. No-op in production. */
export function markDevStartupPerf(label: string, extra?: Record<string, unknown>): void {
  if (!devPerformanceEnabled()) return;
  const elapsedMs = Math.round(
    (typeof performance !== "undefined" ? performance.now() : Date.now()) - bootMs
  );
  console.info(`[startup-perf] ${label}`, { elapsed_ms: elapsedMs, ...extra });
}
