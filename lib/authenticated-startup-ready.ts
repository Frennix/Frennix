import { Platform } from "react-native";

const FEED_MEANINGFUL =
  /STORIES|Share workout|Your feed is ready|Could not load feed|This section could not load/i;

function rectH(id: string): number {
  if (typeof document === "undefined") return 0;
  const el = document.getElementById(id);
  if (!el) return -1;
  return Math.round(el.getBoundingClientRect().height);
}

function hasMeaningfulFeedText(): boolean {
  if (typeof document === "undefined") return false;
  const bodyText = (document.body?.innerText ?? "").replace(/\s+/g, " ").trim();
  return FEED_MEANINGFUL.test(bodyText);
}

function feedDestinationReady(): boolean {
  const feedRootH = rectH("feed-root-container");
  const feedTabSceneH = rectH("feed-tab-scene");
  if (feedRootH > 80) return true;
  if (feedTabSceneH > 120 && feedRootH > 40 && hasMeaningfulFeedText()) return true;
  return false;
}

/** DOM markers that mean post-login startup reached a visible destination. */
const DESTINATION_MARKERS = [
  "onboarding-screen",
  "startup-retry-screen",
  "post-login-failure-screen",
  "authenticated-startup-fallback",
] as const;

/** True when the user can see feed, onboarding, or an explicit error/retry screen. */
export function isAuthenticatedDestinationReady(): boolean {
  if (typeof document === "undefined") return false;

  if (feedDestinationReady()) return true;

  for (const id of DESTINATION_MARKERS) {
    const node = document.getElementById(id);
    if (!node) continue;
    const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
    if (text.length > 0) return true;
  }

  const bodyText = (document.body?.innerText ?? "").replace(/\s+/g, " ").trim();
  if (/Set up profile|Could not load|Something went wrong|This section could not load/i.test(bodyText)) {
    return true;
  }

  return false;
}

/** Exported for diagnostics — detects tab-bar-only false ready state. */
export function describeFeedLayoutReadiness(): {
  feedTabSceneH: number;
  feedRootH: number;
  feedMeaningfulText: boolean;
  ready: boolean;
} {
  const feedTabSceneH = rectH("feed-tab-scene");
  const feedRootH = rectH("feed-root-container");
  const feedMeaningfulText = hasMeaningfulFeedText();
  return {
    feedTabSceneH,
    feedRootH,
    feedMeaningfulText,
    ready: feedDestinationReady(),
  };
}
