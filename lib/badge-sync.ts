import { Platform } from "react-native";

type NavigatorWithBadge = Navigator & {
  setAppBadge?: (count: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

/** Sync app icon badge — native via expo-notifications; PWA via Badging API when available. */
export async function syncAppBadgeCount(count: number): Promise<void> {
  const safeCount = Math.max(0, Math.floor(count));

  if (Platform.OS === "web" && typeof navigator !== "undefined") {
    const nav = navigator as NavigatorWithBadge;
    try {
      if (safeCount === 0 && nav.clearAppBadge) {
        await nav.clearAppBadge();
      } else if (nav.setAppBadge) {
        await nav.setAppBadge(safeCount);
      }
    } catch {
      // Badging API unsupported or denied — in-app tab badges still update
    }
    return;
  }
}
