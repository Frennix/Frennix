import { Platform } from "react-native";
import { spacing } from "@frennix/ui";
import {
  measureSafariVisualViewport,
  OVERLAY_BOTTOM_SAFETY_MARGIN_PX,
} from "@/lib/safari-visual-viewport";

/** Matches FRENNIX_TAB_BAR_BASE_PX in lib/web-document-styles.js */
export const FEED_TAB_BAR_BASE_PX = 56;

export type FeedScrollBottomPaddingInput = {
  tabBarHeightPx: number;
  envSafeAreaBottomPx: number;
  safariBottomChromePx: number;
};

function measureTabBarHeightPx(): number {
  if (typeof document === "undefined") return 0;
  const tablist = document.querySelector('[role="tablist"]');
  if (!tablist) return 0;
  return Math.ceil(tablist.getBoundingClientRect().height);
}

/** Reserve below feed posts so captions clear the fixed tab bar + Safari bottom chrome. */
export function computeFeedScrollBottomPadding(input: FeedScrollBottomPaddingInput): number {
  const tabReserve = Math.max(
    input.tabBarHeightPx,
    FEED_TAB_BAR_BASE_PX + input.envSafeAreaBottomPx
  );
  return (
    tabReserve + input.safariBottomChromePx + OVERLAY_BOTTOM_SAFETY_MARGIN_PX + spacing.sm
  );
}

/** Read live DOM + visual viewport measurements for the home feed scroll surface. */
export function measureFeedScrollBottomPadding(): number {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return spacing.xxl + spacing.lg + spacing.sm;
  }

  const snapshot = measureSafariVisualViewport();
  return computeFeedScrollBottomPadding({
    tabBarHeightPx: measureTabBarHeightPx(),
    envSafeAreaBottomPx: snapshot.envSafeAreaBottom,
    safariBottomChromePx: snapshot.bottomChrome,
  });
}

export function syncFeedScrollBottomPaddingCssVars(paddingPx: number, safariBottomChromePx: number): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--frennix-safari-bottom-chrome", `${safariBottomChromePx}px`);
  root.style.setProperty("--frennix-feed-scroll-bottom-pad", `${paddingPx}px`);
}
