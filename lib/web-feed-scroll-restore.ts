import { restoreWebHorizontalScrollPosition } from "@/lib/web-horizontal-scroll-restore";

const FEED_SCROLL_LIST_ID = "feed-scroll-list";
const STORAGE_KEY = "frennix:feed-scroll-return";
const MAX_AGE_MS = 30 * 60 * 1000;

export type FeedScrollReturnState = {
  feedScrollTop: number;
  savedAt: number;
};

/** Save feed scroll position before navigating to the dedicated comments route. */
export function saveFeedScrollReturnState(): void {
  if (typeof document === "undefined" || typeof sessionStorage === "undefined") return;

  const feed = document.getElementById(FEED_SCROLL_LIST_ID);
  const state: FeedScrollReturnState = {
    feedScrollTop: feed?.scrollTop ?? 0,
    savedAt: Date.now(),
  };

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // sessionStorage may be unavailable in private mode
  }
}

function readSavedFeedScrollTop(): number | null {
  if (typeof sessionStorage === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(STORAGE_KEY);
    const parsed = JSON.parse(raw) as FeedScrollReturnState;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) return null;
    return Number.isFinite(parsed.feedScrollTop) ? parsed.feedScrollTop : 0;
  } catch {
    return null;
  }
}

/** Restore feed vertical scroll and horizontal centering after leaving the comments route. */
export function restoreFeedScrollReturnState(): void {
  if (typeof document === "undefined") return;

  const savedTop = readSavedFeedScrollTop();
  restoreWebHorizontalScrollPosition();

  if (savedTop === null) return;

  const feed = document.getElementById(FEED_SCROLL_LIST_ID);
  if (!feed) return;

  const apply = () => {
    feed.scrollTop = savedTop;
  };
  apply();
  requestAnimationFrame(apply);
}
