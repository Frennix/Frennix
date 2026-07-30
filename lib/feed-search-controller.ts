import { Keyboard, Platform } from "react-native";

type FeedSearchController = {
  open: () => void;
  close: () => void;
  reset: () => void;
  isOpen: () => boolean;
  isStale: () => boolean;
};

let controller: FeedSearchController | null = null;
let savedScrollY = 0;

export function registerFeedSearchController(next: FeedSearchController | null) {
  controller = next;
}

export function openFeedSearch() {
  controller?.open();
}

export function closeFeedSearch() {
  controller?.close();
}

export function resetFeedSearch() {
  controller?.reset();
}

export function isFeedSearchOpen() {
  return controller?.isOpen() ?? false;
}

export function isFeedSearchStale() {
  return controller?.isStale() ?? false;
}

export function rememberFeedScrollY(y: number) {
  savedScrollY = Math.max(0, y);
}

export function consumeFeedScrollY() {
  const y = savedScrollY;
  savedScrollY = 0;
  return y;
}

/** Clears accidental horizontal drift without dismissing the keyboard. */
export function resetFeedHorizontalScroll() {
  if (Platform.OS !== "web" || typeof document === "undefined") return;

  document.documentElement.scrollLeft = 0;
  document.body.scrollLeft = 0;

  for (const id of [
    "feed-tab-scene",
    "feed-root-container",
    "feed-scroll-shell",
    "feed-scroll-list",
    "feed-search-section",
    "feed-search-overlay",
  ]) {
    const element = document.getElementById(id);
    if (element && "scrollLeft" in element) {
      (element as HTMLElement).scrollLeft = 0;
    }
  }

  if (typeof window !== "undefined") {
    window.scrollTo({ left: 0, top: window.scrollY, behavior: "auto" });
  }
}

/** Full layout reset when leaving search or the feed screen. */
export function resetFeedScrollLayout() {
  Keyboard.dismiss();
  resetFeedHorizontalScroll();
}
