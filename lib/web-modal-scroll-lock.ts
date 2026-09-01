const FEED_SCROLL_LIST_ID = "feed-scroll-list";

type SavedDocumentStyles = {
  bodyOverflow: string;
  bodyPosition: string;
  bodyTop: string;
  bodyWidth: string;
  bodyTouchAction: string;
  bodyOverscrollBehavior: string;
  htmlOverflow: string;
  htmlTouchAction: string;
  htmlOverscrollBehavior: string;
};

let lockDepth = 0;
let savedDocument: SavedDocumentStyles | null = null;

function readFeedScrollElement(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.getElementById(FEED_SCROLL_LIST_ID);
}

function readInlineStyle(el: HTMLElement, prop: keyof CSSStyleDeclaration): string {
  const value = el.style[prop];
  return typeof value === "string" ? value : "";
}

/** Clear stale inline scroll/touch locks on the feed scrollport (Safari BUG-004 recovery). */
export function clearFeedScrollInlineLocks(): void {
  const feed = readFeedScrollElement();
  if (!feed) return;
  feed.style.removeProperty("overflow");
  feed.style.removeProperty("overflow-y");
  feed.style.removeProperty("overflow-x");
  feed.style.removeProperty("touch-action");
}

/**
 * Restore document + feed scroll surfaces after overlays close.
 * Safe to call repeatedly — clears orphaned locks from overlapping modals.
 */
export function restoreWebDocumentScrollLock(): void {
  if (typeof document === "undefined") return;

  clearFeedScrollInlineLocks();

  document.body.style.removeProperty("overflow");
  document.body.style.removeProperty("position");
  document.body.style.removeProperty("top");
  document.body.style.removeProperty("width");
  document.body.style.removeProperty("touch-action");
  document.body.style.removeProperty("overscroll-behavior");

  document.documentElement.style.removeProperty("overflow");
  document.documentElement.style.removeProperty("touch-action");
  document.documentElement.style.removeProperty("overscroll-behavior");

  lockDepth = 0;
  savedDocument = null;
}

/**
 * Track an active root-level modal. Locks document scroll on body/html only — never mutates
 * #feed-scroll-list (inline feed touchAction/overflow breaks Safari pan-y, BUG-004).
 */
export function lockWebModalScroll(): void {
  if (typeof document === "undefined") return;

  if (lockDepth === 0) {
    savedDocument = {
      bodyOverflow: readInlineStyle(document.body, "overflow"),
      bodyPosition: readInlineStyle(document.body, "position"),
      bodyTop: readInlineStyle(document.body, "top"),
      bodyWidth: readInlineStyle(document.body, "width"),
      bodyTouchAction: readInlineStyle(document.body, "touchAction"),
      bodyOverscrollBehavior: readInlineStyle(document.body, "overscrollBehavior"),
      htmlOverflow: readInlineStyle(document.documentElement, "overflow"),
      htmlTouchAction: readInlineStyle(document.documentElement, "touchAction"),
      htmlOverscrollBehavior: readInlineStyle(document.documentElement, "overscrollBehavior"),
    };

    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";
  }

  lockDepth += 1;
}

/** Release one modal scroll lock; restore document styles when the final modal closes. */
export function unlockWebModalScroll(): void {
  if (typeof document === "undefined" || lockDepth === 0) return;

  lockDepth -= 1;
  if (lockDepth > 0 || !savedDocument) return;

  const saved = savedDocument;
  savedDocument = null;

  const restoreProp = (el: HTMLElement, prop: string, value: string) => {
    if (value) el.style.setProperty(prop, value);
    else el.style.removeProperty(prop);
  };

  restoreProp(document.body, "overflow", saved.bodyOverflow);
  restoreProp(document.body, "position", saved.bodyPosition);
  restoreProp(document.body, "top", saved.bodyTop);
  restoreProp(document.body, "width", saved.bodyWidth);
  restoreProp(document.body, "touch-action", saved.bodyTouchAction);
  restoreProp(document.body, "overscroll-behavior", saved.bodyOverscrollBehavior);

  restoreProp(document.documentElement, "overflow", saved.htmlOverflow);
  restoreProp(document.documentElement, "touch-action", saved.htmlTouchAction);
  restoreProp(document.documentElement, "overscroll-behavior", saved.htmlOverscrollBehavior);

  clearFeedScrollInlineLocks();
}

export function getWebModalScrollLockDepth(): number {
  return lockDepth;
}

export type FeedTouchDiagnostics = {
  lockDepth: number;
  feedScrollTop: number;
  feedTouchAction: string;
  feedOverflowY: string;
  bodyOverflow: string;
  bodyPosition: string;
  bodyTouchAction: string;
  htmlOverflow: string;
  htmlTouchAction: string;
  elementFromPoint: string | null;
  mountedPortals: string[];
  hiddenModalCount: number;
};

/** Dev/test probe for Safari feed touch regressions. */
export function collectFeedTouchDiagnostics(): FeedTouchDiagnostics {
  if (typeof document === "undefined") {
    return {
      lockDepth,
      feedScrollTop: 0,
      feedTouchAction: "n/a",
      feedOverflowY: "n/a",
      bodyOverflow: "n/a",
      bodyPosition: "n/a",
      bodyTouchAction: "n/a",
      htmlOverflow: "n/a",
      htmlTouchAction: "n/a",
      elementFromPoint: null,
      mountedPortals: [],
      hiddenModalCount: 0,
    };
  }

  const feed = readFeedScrollElement();
  const feedStyle = feed ? getComputedStyle(feed) : null;
  const bodyStyle = getComputedStyle(document.body);
  const htmlStyle = getComputedStyle(document.documentElement);

  const cx = Math.round(window.innerWidth / 2);
  const cy = Math.round(window.innerHeight * 0.55);
  const hit = document.elementFromPoint(cx, cy);
  const elementFromPoint =
    hit instanceof Element
      ? `${hit.tagName.toLowerCase()}${hit.id ? `#${hit.id}` : ""}`
      : null;

  const portalSelectors = [
    '[data-frennix-comments-sheet="true"]',
    '[data-frennix-comment-options="true"]',
    '[data-frennix-comment-edit="true"]',
    '[data-frennix-comment-report="true"]',
    '[data-frennix-image-lightbox="true"]',
  ];
  const mountedPortals = portalSelectors.filter((sel) => document.querySelector(sel));

  return {
    lockDepth,
    feedScrollTop: feed?.scrollTop ?? 0,
    feedTouchAction: feedStyle?.touchAction ?? "missing",
    feedOverflowY: feedStyle?.overflowY ?? "missing",
    bodyOverflow: bodyStyle.overflow,
    bodyPosition: bodyStyle.position,
    bodyTouchAction: bodyStyle.touchAction,
    htmlOverflow: htmlStyle.overflow,
    htmlTouchAction: htmlStyle.touchAction,
    elementFromPoint,
    mountedPortals,
    hiddenModalCount: document.querySelectorAll('[role="dialog"],[aria-modal="true"]').length,
  };
}

if (typeof window !== "undefined") {
  (window as Window & { __FRENNIX_FEED_TOUCH_DIAG__?: () => FeedTouchDiagnostics }).__FRENNIX_FEED_TOUCH_DIAG__ =
    collectFeedTouchDiagnostics;
}
