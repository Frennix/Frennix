import { requestSafariVisualViewportRemeasure } from "@/lib/safari-visual-viewport";

const SHEET_ROOT_ID = "bottom-action-sheet";
const SHEET_SCROLL_ID = "bottom-action-sheet-scroll";

type SavedStyles = {
  scrollY: number;
  htmlOverflow: string;
  htmlOverscroll: string;
  bodyOverflow: string;
  bodyPosition: string;
  bodyTop: string;
  bodyLeft: string;
  bodyRight: string;
  bodyWidth: string;
  bodyOverscroll: string;
};

let lockDepth = 0;
let saved: SavedStyles | null = null;

function readStyle(el: HTMLElement, prop: string): string {
  return el.style.getPropertyValue(prop);
}

/**
 * Stop the page behind an open sheet from scrolling.
 * iOS Safari otherwise pans the layout viewport when a field is focused.
 */
export function containDocumentScrollForSheet(): () => void {
  if (typeof document === "undefined") return () => undefined;

  if (lockDepth === 0) {
    const html = document.documentElement;
    const body = document.body;
    saved = {
      scrollY: window.scrollY,
      htmlOverflow: readStyle(html, "overflow"),
      htmlOverscroll: readStyle(html, "overscroll-behavior"),
      bodyOverflow: readStyle(body, "overflow"),
      bodyPosition: readStyle(body, "position"),
      bodyTop: readStyle(body, "top"),
      bodyLeft: readStyle(body, "left"),
      bodyRight: readStyle(body, "right"),
      bodyWidth: readStyle(body, "width"),
      bodyOverscroll: readStyle(body, "overscroll-behavior"),
    };
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    body.style.position = "fixed";
    body.style.top = `-${saved.scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
  }

  lockDepth += 1;
  let released = false;

  const pinWindowScroll = () => {
    if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0);
  };
  window.addEventListener("scroll", pinWindowScroll, { passive: true });

  return () => {
    window.removeEventListener("scroll", pinWindowScroll);
    if (released) return;
    released = true;
    lockDepth = Math.max(0, lockDepth - 1);
    if (lockDepth > 0 || !saved) return;

    const html = document.documentElement;
    const body = document.body;
    const previous = saved;
    saved = null;

    const restore = (el: HTMLElement, prop: string, value: string) => {
      if (value) el.style.setProperty(prop, value);
      else el.style.removeProperty(prop);
    };

    restore(html, "overflow", previous.htmlOverflow);
    restore(html, "overscroll-behavior", previous.htmlOverscroll);
    restore(body, "overflow", previous.bodyOverflow);
    restore(body, "position", previous.bodyPosition);
    restore(body, "top", previous.bodyTop);
    restore(body, "left", previous.bodyLeft);
    restore(body, "right", previous.bodyRight);
    restore(body, "width", previous.bodyWidth);
    restore(body, "overscroll-behavior", previous.bodyOverscroll);
    window.scrollTo(0, previous.scrollY);
    requestSafariVisualViewportRemeasure();
  };
}

/** Scroll the sheet's own scroller so the focused field stays inside the visual viewport. */
export function revealFocusedSheetField(): void {
  if (typeof document === "undefined") return;
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return;

  const root = document.getElementById(SHEET_ROOT_ID);
  const scroller = document.getElementById(SHEET_SCROLL_ID);
  if (!root || !scroller || !scroller.contains(active)) return;

  const visibleHeight = window.visualViewport?.height ?? window.innerHeight;
  const padding = 12;
  const rect = active.getBoundingClientRect();

  if (rect.bottom > visibleHeight - padding) {
    scroller.scrollTop += rect.bottom - (visibleHeight - padding);
  } else if (rect.top < padding) {
    scroller.scrollTop -= padding - rect.top;
  }
}

export { SHEET_ROOT_ID, SHEET_SCROLL_ID };
