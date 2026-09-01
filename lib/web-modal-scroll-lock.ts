const FEED_SCROLL_LIST_ID = "feed-scroll-list";

type SavedScrollState = {
  feedScrollTop: number;
  feedOverflow: string;
  feedTouchAction: string;
  bodyOverflow: string;
  bodyPosition: string;
  bodyTop: string;
  bodyWidth: string;
  htmlOverflow: string;
};

let lockDepth = 0;
let saved: SavedScrollState | null = null;

function readFeedScrollElement(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.getElementById(FEED_SCROLL_LIST_ID);
}

/** Freeze feed scroll and lock the document while a root-level modal is open (Safari/PWA). */
export function lockWebModalScroll(): void {
  if (typeof document === "undefined") return;
  if (lockDepth === 0) {
    const feed = readFeedScrollElement();
    saved = {
      feedScrollTop: feed?.scrollTop ?? 0,
      feedOverflow: feed?.style.overflow ?? "",
      feedTouchAction: feed?.style.touchAction ?? "",
      bodyOverflow: document.body.style.overflow,
      bodyPosition: document.body.style.position,
      bodyTop: document.body.style.top,
      bodyWidth: document.body.style.width,
      htmlOverflow: document.documentElement.style.overflow,
    };

    if (feed) {
      feed.style.overflow = "hidden";
      feed.style.touchAction = "none";
    }

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
  }
  lockDepth += 1;
}

/** Restore feed scroll position and document overflow after modal close. */
export function unlockWebModalScroll(): void {
  if (typeof document === "undefined" || lockDepth === 0) return;
  lockDepth -= 1;
  if (lockDepth > 0 || !saved) return;

  const feed = readFeedScrollElement();
  if (feed) {
    feed.style.overflow = saved.feedOverflow;
    feed.style.touchAction = saved.feedTouchAction;
    feed.scrollTop = saved.feedScrollTop;
  }

  if (saved.bodyOverflow) document.body.style.overflow = saved.bodyOverflow;
  else document.body.style.removeProperty("overflow");

  if (saved.bodyPosition) document.body.style.position = saved.bodyPosition;
  else document.body.style.removeProperty("position");

  if (saved.bodyTop) document.body.style.top = saved.bodyTop;
  else document.body.style.removeProperty("top");

  if (saved.bodyWidth) document.body.style.width = saved.bodyWidth;
  else document.body.style.removeProperty("width");

  if (saved.htmlOverflow) document.documentElement.style.overflow = saved.htmlOverflow;
  else document.documentElement.style.removeProperty("overflow");

  saved = null;
}
