/** Production feed phases — runs after startup trace reaches feed-route:mounted. */
export const FEED_RENDER_EXPECTED = [
  "feed:HomeScreen:render",
  "feed:HomeScreen:hooks-complete",
  "feed:HomeScreen:mounted",
  "feed:data:stories",
  "feed:data:feed-query",
  "feed:data:suggestions",
  "feed:branch:main",
  "feed:ui:container",
  "feed:ui:scroll-list",
  "feed:ui:list-header",
  "feed:ui:scroll-list-layout",
  "feed:ui:post-action-sheets",
  "feed:ui:share-sheet",
  "feed:ui:lightbox",
  "feed:ui:story-viewer",
] as const;

export type FeedRenderPhase = (typeof FEED_RENDER_EXPECTED)[number] | string;

export type FeedRenderEvent = {
  id: string;
  kind: "sync" | "effect" | "data";
  detail?: string;
  atMs: number;
  iso: string;
};

const events: FeedRenderEvent[] = [];
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
  (window as Window & { __FRENNIX_FEED_RENDER_TRACE__?: FeedRenderEvent[] }).__FRENNIX_FEED_RENDER_TRACE__ =
    [...events];
}

export function markFeedRender(
  id: FeedRenderPhase,
  kind: "sync" | "effect" | "data" = "sync",
  detail?: string
) {
  if (kind === "sync") {
    if (seenSyncIds.has(id)) return;
    seenSyncIds.add(id);
  }
  events.push({ id, kind, detail, atMs: nowMs(), iso: new Date().toISOString() });
  notify();
}

export function getFeedRenderEvents(): readonly FeedRenderEvent[] {
  return events;
}

export function subscribeFeedRender(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** First feed phase never reached after feed-route mounted. */
export function getFeedRenderGap(): string | null {
  const seen = new Set(events.map((event) => event.id));
  for (const expected of FEED_RENDER_EXPECTED) {
    if (seen.has(expected)) continue;
    if (seen.has(`${expected}:render`)) return `${expected} (render started, effect/mount missing)`;
    return expected;
  }
  return null;
}

export function formatFeedRenderSummary(limit = 8): string {
  const gap = getFeedRenderGap();
  const recent = events.slice(-limit).map((event) => {
    if (event.detail) return `${event.id}(${event.detail})`;
    return event.id;
  });
  return [
    gap ? `FEED STUCK BEFORE: ${gap}` : "FEED: all expected phases reached",
    recent.join(" → "),
  ].join(" | ");
}
