/** Home feed scroll list marker — RN Web ScrollView nativeID (outer wrapper). */
export const FEED_SCROLL_LIST_ID = "feed-scroll-list";

export function buildFeedPostAnchorId(postId: string): string {
  return `feed-post-${postId}`;
}

function isScrollableOverflow(value: string): boolean {
  return value === "auto" || value === "scroll" || value === "overlay";
}

/**
 * RN Web ScrollView often scrolls on a nested overflow child, not the nativeID wrapper.
 * Walk descendants to find the element whose scrollTop actually changes during feed pan.
 */
export function resolveFeedScrollPort(root?: HTMLElement | null): HTMLElement | null {
  if (typeof document === "undefined") return null;

  const start = root ?? document.getElementById(FEED_SCROLL_LIST_ID);
  if (!start) return null;

  const queue: HTMLElement[] = [start];
  while (queue.length > 0) {
    const el = queue.shift()!;
    const style = getComputedStyle(el);
    const canScroll =
      el.scrollHeight > el.clientHeight + 4 &&
      (isScrollableOverflow(style.overflowY) || isScrollableOverflow(style.overflow));
    if (canScroll) return el;
    for (let i = 0; i < el.children.length; i += 1) {
      const child = el.children.item(i);
      if (child instanceof HTMLElement) queue.push(child);
    }
  }

  return start;
}

export type FeedScrollOffsetSnapshot = {
  /** Scroll offset on the resolved feed scrollport (primary on mobile web). */
  feedScrollTop: number;
  /** Document scroll — usually 0 because the feed uses an internal scrollport. */
  windowScrollY: number;
};

/** Read the live feed scroll offsets from DOM scrollports. */
export function readFeedScrollOffsetSnapshot(): FeedScrollOffsetSnapshot {
  if (typeof window === "undefined") {
    return { feedScrollTop: 0, windowScrollY: 0 };
  }

  const port = resolveFeedScrollPort();
  return {
    feedScrollTop: port?.scrollTop ?? 0,
    windowScrollY: window.scrollY ?? 0,
  };
}

export function findFeedPostElement(postId: string): HTMLElement | null {
  if (typeof document === "undefined" || !postId) return null;
  return (
    document.getElementById(buildFeedPostAnchorId(postId)) ??
    (document.querySelector(`[data-feed-post-id="${postId}"]`) as HTMLElement | null)
  );
}

/** Whether the feed tab scrollport is visible enough to capture a reliable offset. */
export function isFeedScrollPortVisible(minHeight = 60): boolean {
  const port = resolveFeedScrollPort();
  if (!port) return false;
  const rect = port.getBoundingClientRect();
  return rect.height >= minHeight && rect.bottom > 0 && rect.top < window.innerHeight;
}
