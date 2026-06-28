import { Platform } from "react-native";

const STORAGE_KEY = "frennix:feedDebug";
const LOG_PREFIX = "[feed-scroll-debug]";

/** Persist debug flag on first URL hit — survives login redirects that strip query params. */
export function bootstrapFeedScrollDebug(): void {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has("feedDebug")) {
      window.localStorage.setItem(STORAGE_KEY, "1");
    }
  } catch {
    // ignore storage failures
  }
}

if (Platform.OS === "web") {
  bootstrapFeedScrollDebug();
}

export function isFeedScrollDebugEnabled(): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  bootstrapFeedScrollDebug();
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has("feedDebug")) return true;
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Isolation test only — add &feedScrollTest=1 (requires feedDebug=1). */
export function isFeedScrollTestMode(): boolean {
  if (!isFeedScrollDebugEnabled() || typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("feedScrollTest") === "1";
  } catch {
    return false;
  }
}

export function getFeedDebugStatusLine(): string {
  if (Platform.OS !== "web" || typeof window === "undefined") return "web only";
  try {
    const params = new URLSearchParams(window.location.search);
    const urlFlag = params.has("feedDebug") ? "url=yes" : "url=no";
    const stored = window.localStorage.getItem(STORAGE_KEY) === "1" ? "ls=yes" : "ls=no";
    const testMode = isFeedScrollTestMode() ? "scrollTest=yes" : "scrollTest=no";
    return `${urlFlag} ${stored} ${testMode}`;
  } catch {
    return "status unavailable";
  }
}

export function clearFeedScrollDebug(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

type FeedScrollMetrics = {
  listLayoutHeight: number;
  contentHeight: number;
  viewportHeight: number;
  scrollEnabled: boolean;
  storyVisible: boolean;
};

export function logFeedScrollMetrics(metrics: FeedScrollMetrics) {
  if (!isFeedScrollDebugEnabled()) return;

  const scrollable = metrics.contentHeight > metrics.listLayoutHeight + 1;
  console.info(LOG_PREFIX, "metrics", {
    ...metrics,
    scrollable,
    bodyOverflow: typeof document !== "undefined" ? getComputedStyle(document.body).overflow : "n/a",
    rootHeight: typeof document !== "undefined" ? document.getElementById("root")?.clientHeight : null,
  });
}

let lastScrollLogAt = 0;

export function logFeedScrollEvent(offsetY: number, contentHeight: number, layoutHeight: number) {
  if (!isFeedScrollDebugEnabled()) return;

  const now = Date.now();
  if (now - lastScrollLogAt < 400) return;
  lastScrollLogAt = now;

  console.info(LOG_PREFIX, "onScroll", {
    offsetY: Math.round(offsetY),
    contentHeight: Math.round(contentHeight),
    layoutHeight: Math.round(layoutHeight),
  });
}

export function inspectFeedScrollContainer(listRef: { getNativeScrollRef?: () => unknown } | null) {
  if (!isFeedScrollDebugEnabled() || !listRef?.getNativeScrollRef) return;

  const scrollNode = listRef.getNativeScrollRef() as HTMLElement | null;
  if (!scrollNode || typeof scrollNode !== "object") {
    console.warn(LOG_PREFIX, "scroll ref missing");
    return;
  }

  const style = getComputedStyle(scrollNode);
  console.info(LOG_PREFIX, "scroll container", {
    clientHeight: scrollNode.clientHeight,
    scrollHeight: scrollNode.scrollHeight,
    scrollable: scrollNode.scrollHeight > scrollNode.clientHeight + 1,
    overflowY: style.overflowY,
    touchAction: style.touchAction,
    pointerEvents: style.pointerEvents,
  });
}
