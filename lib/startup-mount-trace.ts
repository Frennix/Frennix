/** Ordered startup phases — first gap after login is the failure point. */
export const STARTUP_MOUNT_EXPECTED = [
  "entry:module-load",
  "entry:createRoot:before",
  "entry:createRoot:returned",
  "entry:expo-router-loaded",
  "entry:createRoot:render:start",
  "entry:createRoot:render:end",
  "init-supabase:module",
  "root-layout:render",
  "gesture-handler:render",
  "gesture-handler:mounted",
  "app-error-boundary-root:render",
  "query-provider:render",
  "query-provider:mounted",
  "auth-provider:render",
  "auth-provider:mounted",
  "tab-badge-root:render",
  "navigation-error-boundary:render",
  "navigation-error-boundary:mounted",
  "notification-bootstrap:mounted",
  "push-registration-bootstrap:mounted",
  "product-analytics-bootstrap:mounted",
  "presence-coordinator:mounted",
  "auth-navigation-guard:mounted",
  "stack:render",
  "stack:mounted",
  "index-route:render",
  "index-route:mounted",
  "tabs-layout:render",
  "tabs-layout:mounted",
  "feed-route:render",
  "feed-route:mounted",
] as const;

export type StartupMountId = (typeof STARTUP_MOUNT_EXPECTED)[number] | string;

export type StartupMountEvent = {
  id: string;
  kind: "sync" | "effect";
  atMs: number;
  iso: string;
};

const events: StartupMountEvent[] = [];
const listeners = new Set<() => void>();
const seenSyncIds = new Set<string>();

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function notify() {
  listeners.forEach((listener) => listener());
  publishToWindow();
}

function publishToWindow() {
  if (typeof window === "undefined") return;
  (window as Window & { __FRENNIX_MOUNT_TRACE__?: StartupMountEvent[] }).__FRENNIX_MOUNT_TRACE__ =
    [...events];
}

export function markStartupMount(id: StartupMountId, kind: "sync" | "effect" = "sync") {
  if (kind === "sync") {
    if (seenSyncIds.has(id)) return;
    seenSyncIds.add(id);
  }
  events.push({ id, kind, atMs: nowMs(), iso: new Date().toISOString() });
  notify();
}

export function getStartupMountEvents(): readonly StartupMountEvent[] {
  return events;
}

export function subscribeStartupMount(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** First expected phase that never fired — likely hang/crash location. */
export function getStartupMountGap(): string | null {
  const seen = new Set(events.map((event) => event.id));
  for (const expected of STARTUP_MOUNT_EXPECTED) {
    if (!seen.has(expected)) return expected;
  }
  return null;
}

export function formatStartupMountSummary(limit = 10): string {
  const gap = getStartupMountGap();
  const recent = events.slice(-limit).map((event) => event.id);
  return [
    gap ? `STUCK BEFORE: ${gap}` : "ALL EXPECTED PHASES REACHED",
    `trace (${events.length}): ${recent.join(" → ")}`,
  ].join(" | ");
}
