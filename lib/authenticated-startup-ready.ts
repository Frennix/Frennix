/** DOM markers that mean post-login startup reached a visible destination. */
const DESTINATION_MARKERS = [
  "  feed-tab-scene",
  "feed-root-container",
  "onboarding-screen",
  "startup-retry-screen",
  "post-login-failure-screen",
  "authenticated-startup-fallback",
] as const;

/** True when the user can see feed, onboarding, or an explicit error/retry screen. */
export function isAuthenticatedDestinationReady(): boolean {
  if (typeof document === "undefined") return false;

  for (const id of DESTINATION_MARKERS) {
    const node = document.getElementById(id);
    if (!node) continue;
    const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
    if (text.length > 0) return true;
  }

  const bodyText = (document.body?.innerText ?? "").replace(/\s+/g, " ").trim();
  if (/Set up profile|Share workout|STORIES|Could not load|Something went wrong|This section could not load/i.test(bodyText)) {
    return true;
  }

  return false;
}
