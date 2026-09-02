import { restoreWebHorizontalScrollPosition } from "@/lib/web-horizontal-scroll-restore";
import {
  buildFeedPostAnchorId,
  findFeedPostElement,
  isFeedScrollPortVisible,
  readFeedScrollOffsetSnapshot,
  resolveFeedScrollPort,
} from "@/lib/web-feed-scroll-port";

const STORAGE_KEY = "frennix:feed-scroll-return";
const MAX_AGE_MS = 30 * 60 * 1000;
const MIN_FEED_HEIGHT = 60;
const RESTORE_TOLERANCE_PX = 32;
const RESTORE_RETRY_MS = 100;
const RESTORE_MAX_ATTEMPTS = 24;

export type FeedScrollReturnState = {
  postId: string | null;
  feedScrollTop: number;
  windowScrollY: number;
  savedAt: number;
};

type FeedScrollController = {
  scrollTo: (y: number) => void;
  readTrackedScrollY: () => number;
};

let feedScrollController: FeedScrollController | null = null;
let trackedFeedScrollY = 0;
let pendingRestore: FeedScrollReturnState | null = null;
let restoreAttempts = 0;
let restoreTimer: ReturnType<typeof setTimeout> | null = null;
let restoreInFlight = false;

export function registerFeedScrollController(controller: FeedScrollController | null): void {
  feedScrollController = controller;
}

/** Called from feed onScroll — most reliable capture path on RN Web. */
export function trackFeedScrollPosition(scrollY: number): void {
  if (!Number.isFinite(scrollY) || scrollY < 0) return;
  trackedFeedScrollY = scrollY;
}

function readEffectiveFeedScrollTop(): number {
  const dom = readFeedScrollOffsetSnapshot();
  return Math.max(trackedFeedScrollY, dom.feedScrollTop, dom.windowScrollY);
}

function writeStorage(state: FeedScrollReturnState): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // sessionStorage may be unavailable in private mode
  }
}

export function peekFeedScrollReturnState(): FeedScrollReturnState | null {
  if (typeof sessionStorage === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FeedScrollReturnState;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (!Number.isFinite(parsed.feedScrollTop)) parsed.feedScrollTop = 0;
    if (!Number.isFinite(parsed.windowScrollY)) parsed.windowScrollY = 0;
    return parsed;
  } catch {
    return null;
  }
}

function clearStoredFeedScrollReturnState(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

function shouldPreserveExistingOnZeroCapture(
  nextTop: number,
  existing: FeedScrollReturnState | null
): boolean {
  if (!existing || existing.feedScrollTop <= 8) return false;
  if (nextTop > 8) return false;
  return !isFeedScrollPortVisible(MIN_FEED_HEIGHT);
}

/**
 * Save feed scroll position before navigating to the dedicated video/comments route.
 * Never overwrites a meaningful saved offset with zero while the feed is hidden underneath.
 */
export function saveFeedScrollReturnState(options?: { postId?: string | null }): void {
  if (typeof document === "undefined") return;

  const snapshot = readFeedScrollOffsetSnapshot();
  const feedScrollTop = Math.max(readEffectiveFeedScrollTop(), snapshot.feedScrollTop);
  const existing = peekFeedScrollReturnState();

  if (shouldPreserveExistingOnZeroCapture(feedScrollTop, existing)) {
    return;
  }

  const state: FeedScrollReturnState = {
    postId: options?.postId ?? existing?.postId ?? null,
    feedScrollTop,
    windowScrollY: snapshot.windowScrollY,
    savedAt: Date.now(),
  };

  writeStorage(state);
  pendingRestore = state;
}

function scrollFeedPostIntoView(postId: string, scrollPort: HTMLElement): number | null {
  const postEl = findFeedPostElement(postId);
  if (!postEl) return null;

  const portRect = scrollPort.getBoundingClientRect();
  const postRect = postEl.getBoundingClientRect();
  const targetTop = postRect.top - portRect.top + scrollPort.scrollTop;
  scrollPort.scrollTop = Math.max(0, targetTop);
  return scrollPort.scrollTop;
}

function applyFeedScrollOffset(state: FeedScrollReturnState): void {
  restoreWebHorizontalScrollPosition();

  if (typeof window !== "undefined" && state.windowScrollY > 0) {
    window.scrollTo(0, state.windowScrollY);
  }

  if (feedScrollController) {
    feedScrollController.scrollTo(state.feedScrollTop);
  }

  const scrollPort = resolveFeedScrollPort();
  if (!scrollPort || scrollPort.clientHeight < MIN_FEED_HEIGHT) return;

  if (state.postId) {
    const postTop = scrollFeedPostIntoView(state.postId, scrollPort);
    if (postTop !== null) return;
  }

  scrollPort.scrollTop = state.feedScrollTop;
}

function readCurrentRestoreOffset(): number {
  const dom = readFeedScrollOffsetSnapshot();
  const tracked = feedScrollController?.readTrackedScrollY() ?? trackedFeedScrollY;
  return Math.max(tracked, dom.feedScrollTop, dom.windowScrollY);
}

function isRestoreVerified(state: FeedScrollReturnState): boolean {
  if (state.postId) {
    const postEl = findFeedPostElement(state.postId);
    const scrollPort = resolveFeedScrollPort();
    if (postEl && scrollPort && scrollPort.clientHeight >= MIN_FEED_HEIGHT) {
      const portRect = scrollPort.getBoundingClientRect();
      const postRect = postEl.getBoundingClientRect();
      if (postRect.top >= portRect.top - RESTORE_TOLERANCE_PX && postRect.top < portRect.bottom - 48) {
        return true;
      }
    }
  }

  return Math.abs(readCurrentRestoreOffset() - state.feedScrollTop) <= RESTORE_TOLERANCE_PX;
}

function clearRestoreSession(): void {
  pendingRestore = null;
  restoreAttempts = 0;
  restoreInFlight = false;
  if (restoreTimer) {
    clearTimeout(restoreTimer);
    restoreTimer = null;
  }
}

function finalizeRestore(): void {
  clearStoredFeedScrollReturnState();
  clearRestoreSession();
}

function loadPendingRestoreFromStorage(): FeedScrollReturnState | null {
  if (pendingRestore) return pendingRestore;
  const stored = peekFeedScrollReturnState();
  if (!stored) return null;
  pendingRestore = stored;
  return pendingRestore;
}

function attemptFeedScrollReturnRestoreOnce(): boolean {
  const state = pendingRestore;
  if (!state) return false;

  const scrollPort = resolveFeedScrollPort();
  if (!scrollPort || scrollPort.clientHeight < MIN_FEED_HEIGHT) {
    return false;
  }

  applyFeedScrollOffset(state);

  if (!isRestoreVerified(state)) {
    return false;
  }

  finalizeRestore();
  return true;
}

function scheduleRestoreRetries(): void {
  if (!pendingRestore || restoreTimer) return;

  const tick = () => {
    restoreTimer = null;
    if (!pendingRestore) return;

    if (attemptFeedScrollReturnRestoreOnce()) {
      return;
    }

    restoreAttempts += 1;
    if (restoreAttempts >= RESTORE_MAX_ATTEMPTS) {
      if (pendingRestore) {
        applyFeedScrollOffset(pendingRestore);
      }
      finalizeRestore();
      return;
    }

    restoreTimer = setTimeout(tick, RESTORE_RETRY_MS);
  };

  restoreTimer = setTimeout(tick, RESTORE_RETRY_MS);
}

/** Queue restoration after leaving video/comments — storage is kept until verified. */
export function requestFeedScrollReturnRestore(): void {
  if (typeof document === "undefined") return;
  if (restoreInFlight) return;

  const state = loadPendingRestoreFromStorage();
  if (!state) return;

  restoreInFlight = true;
  restoreAttempts = 0;

  if (attemptFeedScrollReturnRestoreOnce()) {
    restoreInFlight = false;
    return;
  }

  scheduleRestoreRetries();
  restoreInFlight = false;
}

/** Feed focus/layout/content-size hook — retries pending restore when the list becomes ready. */
export function applyPendingFeedScrollReturnIfNeeded(): void {
  if (typeof document === "undefined") return;
  if (!pendingRestore && !peekFeedScrollReturnState()) return;

  loadPendingRestoreFromStorage();
  if (!pendingRestore) return;

  restoreAttempts = 0;
  if (attemptFeedScrollReturnRestoreOnce()) {
    return;
  }
  scheduleRestoreRetries();
}

/** @deprecated Prefer requestFeedScrollReturnRestore. */
export function restoreFeedScrollReturnState(): void {
  requestFeedScrollReturnRestore();
}

export { buildFeedPostAnchorId };
