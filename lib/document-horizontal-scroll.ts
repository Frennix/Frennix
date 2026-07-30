import { Platform } from "react-native";

const SCROLL_CONTAINER_IDS = [
  "app-root-shell",
  "feed-tab-scene",
  "feed-root-container",
  "feed-scroll-shell",
  "feed-scroll-list",
  "feed-search-section",
  "feed-search-overlay",
  "discover-scroll",
  "calendar-scroll",
] as const;

/** Forces the document and known scroll shells back to the left edge without changing vertical scroll. */
export function resetDocumentHorizontalScroll() {
  if (Platform.OS !== "web" || typeof document === "undefined") return;

  window.scrollTo({
    left: 0,
    top: window.scrollY,
    behavior: "auto",
  });

  document.documentElement.scrollLeft = 0;
  document.body.scrollLeft = 0;

  for (const id of SCROLL_CONTAINER_IDS) {
    const element = document.getElementById(id);
    if (element && "scrollLeft" in element) {
      (element as HTMLElement).scrollLeft = 0;
    }
  }
}

/** Runs reset after layout/navigation paint on web. */
export function scheduleDocumentHorizontalScrollReset() {
  if (Platform.OS !== "web") return;
  requestAnimationFrame(() => {
    resetDocumentHorizontalScroll();
  });
}
