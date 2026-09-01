import { Platform } from "react-native";
import { isFeedScrollDebugEnabled } from "@/lib/feed-scroll-debug";

const LOG_PREFIX = "[comments-input-zoom-diag]";

export type CommentsInputZoomSnapshot = {
  phase: string;
  focusedTag: string | null;
  focusedType: string | null;
  focusedFontSize: string | null;
  focusedId: string | null;
  vvScale: number;
  vvOffsetLeft: number;
  vvOffsetTop: number;
  vvWidth: number;
  vvHeight: number;
  scrollX: number;
  scrollY: number;
  docScrollLeft: number;
  bodyRectLeft: number;
  bodyRectWidth: number;
  bodyInlineLeft: string;
  bodyInlineTransform: string;
  rootRectLeft: number | null;
  feedRectLeft: number | null;
  feedScrollLeft: number;
  feedScrollTop: number;
};

function readFocusedInput(): Element | null {
  if (typeof document === "undefined") return null;
  const active = document.activeElement;
  if (!(active instanceof Element)) return null;
  if (active.matches('[data-frennix-comment-input="true"], textarea, input')) return active;
  return active.closest('[data-frennix-comment-input="true"]');
}

/** Snapshot viewport scale/offset and horizontal scroll state for iOS input-zoom diagnosis. */
export function collectCommentsInputZoomSnapshot(phase: string): CommentsInputZoomSnapshot {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return {
      phase,
      focusedTag: null,
      focusedType: null,
      focusedFontSize: null,
      focusedId: null,
      vvScale: 1,
      vvOffsetLeft: 0,
      vvOffsetTop: 0,
      vvWidth: 0,
      vvHeight: 0,
      scrollX: 0,
      scrollY: 0,
      docScrollLeft: 0,
      bodyRectLeft: 0,
      bodyRectWidth: 0,
      bodyInlineLeft: "",
      bodyInlineTransform: "",
      rootRectLeft: null,
      feedRectLeft: null,
      feedScrollLeft: 0,
      feedScrollTop: 0,
    };
  }

  const vv = window.visualViewport;
  const focused = readFocusedInput();
  const focusedStyle = focused ? getComputedStyle(focused) : null;
  const bodyRect = document.body.getBoundingClientRect();
  const root = document.getElementById("root");
  const feed = document.getElementById("feed-scroll-list");
  const rootRect = root?.getBoundingClientRect();
  const feedRect = feed?.getBoundingClientRect();

  return {
    phase,
    focusedTag: focused?.tagName.toLowerCase() ?? null,
    focusedType: focused instanceof HTMLInputElement ? focused.type : null,
    focusedFontSize: focusedStyle?.fontSize ?? null,
    focusedId: focused?.id || focused?.getAttribute("data-frennix-comment-input") ? "comment-input" : null,
    vvScale: vv?.scale ?? 1,
    vvOffsetLeft: Math.round(vv?.offsetLeft ?? 0),
    vvOffsetTop: Math.round(vv?.offsetTop ?? 0),
    vvWidth: Math.round(vv?.width ?? window.innerWidth),
    vvHeight: Math.round(vv?.height ?? window.innerHeight),
    scrollX: Math.round(window.scrollX),
    scrollY: Math.round(window.scrollY),
    docScrollLeft: Math.round(document.documentElement.scrollLeft),
    bodyRectLeft: Math.round(bodyRect.left),
    bodyRectWidth: Math.round(bodyRect.width),
    bodyInlineLeft: document.body.style.left,
    bodyInlineTransform: document.body.style.transform,
    rootRectLeft: rootRect ? Math.round(rootRect.left) : null,
    feedRectLeft: feedRect ? Math.round(feedRect.left) : null,
    feedScrollLeft: feed?.scrollLeft ?? 0,
    feedScrollTop: feed?.scrollTop ?? 0,
  };
}

export function logCommentsInputZoomSnapshot(phase: string): CommentsInputZoomSnapshot {
  const snapshot = collectCommentsInputZoomSnapshot(phase);
  if (Platform.OS === "web" && isFeedScrollDebugEnabled()) {
    console.info(LOG_PREFIX, snapshot);
  }
  return snapshot;
}

if (typeof window !== "undefined") {
  (
    window as Window & { __FRENNIX_COMMENTS_INPUT_ZOOM_DIAG__?: () => CommentsInputZoomSnapshot }
  ).__FRENNIX_COMMENTS_INPUT_ZOOM_DIAG__ = () => collectCommentsInputZoomSnapshot("manual");
}
