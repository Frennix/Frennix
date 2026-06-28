import { Platform } from "react-native";

const LOG_PREFIX = "[feed-scroll-debug]";

export function isFeedScrollDebugEnabled(): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has("feedDebug")) return true;
    return window.localStorage.getItem("frennix:feedDebug") === "1";
  } catch {
    return false;
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

let touchDebugInstalled = false;

/** Log which DOM node receives the first touch (overlay / pointer-events diagnosis). */
export function installFeedScrollTouchDebug() {
  if (!isFeedScrollDebugEnabled() || touchDebugInstalled || typeof document === "undefined") return;
  touchDebugInstalled = true;

  const describeTarget = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return { tag: "unknown" };
    const style = getComputedStyle(target);
    return {
      tag: target.tagName.toLowerCase(),
      id: target.id || undefined,
      className: target.className?.toString?.().slice(0, 120) || undefined,
      pointerEvents: style.pointerEvents,
      position: style.position,
      overflowY: style.overflowY,
      zIndex: style.zIndex,
    };
  };

  document.addEventListener(
    "touchstart",
    (event) => {
      console.info(LOG_PREFIX, "touchstart target", describeTarget(event.target));
    },
    { capture: true, passive: true }
  );

  console.info(LOG_PREFIX, "touch listener installed — add ?feedDebug=1 to URL");
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
