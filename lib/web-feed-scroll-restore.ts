import { restoreWebHorizontalScrollPosition } from "@/lib/web-horizontal-scroll-restore";

const FEED_SCROLL_LIST_ID = "feed-scroll-list";
const STORAGE_KEY = "frennix:feed-scroll-return";
const MAX_AGE_MS = 30 * 60 * 1000;
const MIN_FEED_HEIGHT = 60;

export type FeedScrollReturnState = {
  feedScrollTop: number;
  savedAt: number;
};

let pendingRestoreTop: number | null = null;

/** Save feed scroll position before navigating to the dedicated video/comments route. */
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

function applyFeedScrollTop(savedTop: number): boolean {
  const feed = document.getElementById(FEED_SCROLL_LIST_ID);
  if (!feed || feed.clientHeight < MIN_FEED_HEIGHT) return false;

  restoreWebHorizontalScrollPosition();
  const apply = () => {
    feed.scrollTop = savedTop;
  };
  apply();
  requestAnimationFrame(() => {
    apply();
    requestAnimationFrame(apply);
  });
  return true;
}

function tryApplyPendingFeedScrollRestore(): boolean {
  if (pendingRestoreTop === null) return false;
  const savedTop = pendingRestoreTop;
  if (!applyFeedScrollTop(savedTop)) return false;
  pendingRestoreTop = null;
  return true;
}

/**
 * Queue feed scroll restoration after leaving video/comments.
 * Applies immediately when the feed list is already mounted; otherwise waits for layout.
 */
export function requestFeedScrollReturnRestore(): void {
  if (typeof document === "undefined") return;

  const savedTop = readSavedFeedScrollTop();
  if (savedTop === null) return;

  pendingRestoreTop = savedTop;
  tryApplyPendingFeedScrollRestore();
}

/** Apply any queued feed scroll restore once the feed scroll list is ready. */
export function applyPendingFeedScrollReturnIfNeeded(): void {
  if (typeof document === "undefined") return;
  tryApplyPendingFeedScrollRestore();
}

/** @deprecated Prefer requestFeedScrollReturnRestore — kept for existing call sites during migration. */
export function restoreFeedScrollReturnState(): void {
  requestFeedScrollReturnRestore();
}
