import { Keyboard } from "react-native";
import {
  resetDocumentHorizontalScroll,
  scheduleWebViewportNormalize,
} from "@/lib/web-viewport-normalize";

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
  resetDocumentHorizontalScroll();
}

/** Full layout reset when leaving search or the feed screen. */
export function resetFeedScrollLayout() {
  Keyboard.dismiss();
  scheduleWebViewportNormalize();
}
