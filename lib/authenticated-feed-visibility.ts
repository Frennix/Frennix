import { Platform } from "react-native";

export type FeedVisibilitySnapshot = {
  feedTabSceneH: number;
  feedRootH: number;
  feedScrollH: number;
  tabBarH: number;
  feedRootVisible: boolean;
  feedScrollVisible: boolean;
  feedRootOpacity: number;
  feedRootDisplay: string;
  ready: boolean;
};

function rectH(id: string): number {
  if (typeof document === "undefined") return -1;
  const el = document.getElementById(id);
  if (!el) return -1;
  return Math.round(el.getBoundingClientRect().height);
}

export function isDomElementVisuallyReady(id: string, minHeight: number): boolean {
  if (typeof document === "undefined") return false;
  const el = document.getElementById(id);
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  if (Number(style.opacity) < 0.05) return false;
  return rect.height >= minHeight && rect.width >= 20;
}

function elementVisible(id: string, minHeight: number): boolean {
  return isDomElementVisuallyReady(id, minHeight);
}

function tabBarHeight(): number {
  if (typeof document === "undefined") return 0;
  const tablist = document.querySelector('[role="tablist"]');
  if (!tablist) return 0;
  return Math.round(tablist.getBoundingClientRect().height);
}

/** Strict visual readiness — DOM text alone is not sufficient. */
export function measureAuthenticatedFeedVisibility(): FeedVisibilitySnapshot {
  if (Platform.OS !== "web" || typeof document === "undefined") {
    return {
      feedTabSceneH: 0,
      feedRootH: 0,
      feedScrollH: 0,
      tabBarH: 0,
      feedRootVisible: false,
      feedScrollVisible: false,
      feedRootOpacity: 0,
      feedRootDisplay: "native",
      ready: false,
    };
  }

  const feedRoot = document.getElementById("feed-root-container");
  const feedRootStyle = feedRoot ? getComputedStyle(feedRoot) : null;

  const feedRootVisible = elementVisible("feed-root-container", 100);
  const feedScrollVisible = elementVisible("feed-scroll-list", 60);
  const feedTabSceneH = rectH("feed-tab-scene");
  const feedRootH = rectH("feed-root-container");
  const feedScrollH = rectH("feed-scroll-list");
  const tabBarH = tabBarHeight();

  const ready =
    feedScrollVisible ||
    (feedRootVisible && feedRootH >= 120) ||
    (feedTabSceneH >= 200 && feedRootH >= 120);

  return {
    feedTabSceneH,
    feedRootH,
    feedScrollH,
    tabBarH,
    feedRootVisible,
    feedScrollVisible,
    feedRootOpacity: feedRootStyle ? Number(feedRootStyle.opacity) : 0,
    feedRootDisplay: feedRootStyle?.display ?? "missing",
    ready,
  };
}

export function isAuthenticatedFeedVisuallyReady(): boolean {
  return measureAuthenticatedFeedVisibility().ready;
}
