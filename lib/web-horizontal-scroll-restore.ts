const FEED_SCROLL_LIST_ID = "feed-scroll-list";

/** Restore horizontal document/app position without changing vertical feed scroll. */
export function restoreWebHorizontalScrollPosition(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const feed = document.getElementById(FEED_SCROLL_LIST_ID);
  const preservedScrollY = window.scrollY;
  const preservedFeedTop = feed?.scrollTop ?? 0;

  // Never use visualViewport.offsetLeft as scrollX — only reset layout viewport horizontal scroll.
  window.scrollTo(0, preservedScrollY);
  document.documentElement.scrollLeft = 0;
  document.body.scrollLeft = 0;
  if (feed) feed.scrollLeft = 0;

  document.body.style.removeProperty("left");
  document.body.style.removeProperty("right");
  document.body.style.removeProperty("transform");
  document.documentElement.style.removeProperty("transform");

  if (Math.abs(window.scrollY - preservedScrollY) > 1) {
    window.scrollTo(0, preservedScrollY);
  }
  if (feed && Math.abs(feed.scrollTop - preservedFeedTop) > 1) {
    feed.scrollTop = preservedFeedTop;
  }
}

export function readWebHorizontalLayoutHealth(): {
  scrollX: number;
  docScrollLeft: number;
  feedScrollLeft: number;
  feedRectLeft: number | null;
  rootRectLeft: number | null;
  bodyRectLeft: number;
  vvScale: number;
  vvOffsetLeft: number;
} {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return {
      scrollX: 0,
      docScrollLeft: 0,
      feedScrollLeft: 0,
      feedRectLeft: null,
      rootRectLeft: null,
      bodyRectLeft: 0,
      vvScale: 1,
      vvOffsetLeft: 0,
    };
  }

  const vv = window.visualViewport;
  const feed = document.getElementById(FEED_SCROLL_LIST_ID);
  const root = document.getElementById("root");
  return {
    scrollX: Math.round(window.scrollX),
    docScrollLeft: Math.round(document.documentElement.scrollLeft),
    feedScrollLeft: feed?.scrollLeft ?? 0,
    feedRectLeft: feed ? Math.round(feed.getBoundingClientRect().left) : null,
    rootRectLeft: root ? Math.round(root.getBoundingClientRect().left) : null,
    bodyRectLeft: Math.round(document.body.getBoundingClientRect().left),
    vvScale: vv?.scale ?? 1,
    vvOffsetLeft: Math.round(vv?.offsetLeft ?? 0),
  };
}
