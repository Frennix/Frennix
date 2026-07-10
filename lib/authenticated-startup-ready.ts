import { Platform } from "react-native";
import {
  isAuthenticatedFeedVisuallyReady,
  measureAuthenticatedFeedVisibility,
} from "@/lib/authenticated-feed-visibility";

/** DOM markers that mean post-login startup reached a visible destination. */
const DESTINATION_MARKERS = [
  "onboarding-screen",
  "startup-retry-screen",
  "post-login-failure-screen",
  "authenticated-startup-fallback",
  "web-authenticated-startup-fallback",
] as const;

/** True when the user can see feed, onboarding, or an explicit error/retry screen. */
export function isAuthenticatedDestinationReady(): boolean {
  if (typeof document === "undefined") return false;

  if (isAuthenticatedFeedVisuallyReady()) return true;

  for (const id of DESTINATION_MARKERS) {
    const node = document.getElementById(id);
    if (!node) continue;
    const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
    if (text.length > 0) return true;
  }

  const bodyText = (document.body?.innerText ?? "").replace(/\s+/g, " ").trim();
  if (/Set up profile|Could not load your profile|Could not load feed|Something went wrong|This section could not load|Frennix could not finish loading/i.test(bodyText)) {
    return true;
  }

  return false;
}

export { measureAuthenticatedFeedVisibility, isAuthenticatedFeedVisuallyReady };

/** @deprecated Use measureAuthenticatedFeedVisibility */
export function describeFeedLayoutReadiness() {
  const snap = measureAuthenticatedFeedVisibility();
  return {
    feedTabSceneH: snap.feedTabSceneH,
    feedRootH: snap.feedRootH,
    feedMeaningfulText: snap.feedScrollVisible || snap.feedRootVisible,
    ready: snap.ready,
  };
}
