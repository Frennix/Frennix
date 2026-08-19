import { Platform } from "react-native";
import {
  isAuthenticatedFeedVisuallyReady,
  isDomElementVisuallyReady,
  measureAuthenticatedFeedVisibility,
} from "@/lib/authenticated-feed-visibility";

/** DOM markers that mean post-login startup reached a visible destination. */
const DESTINATION_MARKERS: ReadonlyArray<{ id: string; minHeight: number }> = [
  { id: "onboarding-screen", minHeight: 120 },
  { id: "startup-retry-screen", minHeight: 200 },
  { id: "post-login-failure-screen", minHeight: 120 },
  { id: "web-authenticated-startup-fallback", minHeight: 120 },
  { id: "frennix-startup-failure-overlay", minHeight: 120 },
  { id: "auth-login-screen", minHeight: 200 },
  { id: "login-failure-screen", minHeight: 120 },
  { id: "create-post-screen", minHeight: 120 },
  { id: "notifications-screen", minHeight: 120 },
];

/** True when the user can see feed, onboarding, or an explicit error/retry screen. */
export function isAuthenticatedDestinationReady(): boolean {
  if (typeof document === "undefined") return false;

  if (isAuthenticatedFeedVisuallyReady()) return true;

  for (const marker of DESTINATION_MARKERS) {
    if (isDomElementVisuallyReady(marker.id, marker.minHeight)) return true;
  }

  if (Platform.OS === "web") {
    const bodyText = (document.body?.innerText ?? "").replace(/\s+/g, " ").trim();
    if (
      /Frennix could not finish loading/i.test(bodyText) &&
      isDomElementVisuallyReady("web-authenticated-startup-fallback", 80)
    ) {
      return true;
    }
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
