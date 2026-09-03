import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "@frennix/ui";
import {
  computeFeedScrollBottomPadding,
  FEED_TAB_BAR_BASE_PX,
  measureFeedScrollBottomPadding,
  syncFeedScrollBottomPaddingCssVars,
} from "@/lib/feed-scroll-bottom-padding";
import {
  measureSafariVisualViewport,
  OVERLAY_BOTTOM_SAFETY_MARGIN_PX,
  subscribeSafariVisualViewport,
} from "@/lib/safari-visual-viewport";

/** Bottom padding for feed scroll content — clears tab bar, home indicator, and Safari toolbar. */
export function useFeedScrollBottomPadding(): number {
  const insets = useSafeAreaInsets();
  const [padding, setPadding] = useState(() =>
    Platform.OS === "web" ? measureFeedScrollBottomPadding() : 0
  );

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const update = () => {
      const snapshot = measureSafariVisualViewport();
      const next = measureFeedScrollBottomPadding();
      setPadding(next);
      syncFeedScrollBottomPaddingCssVars(next, snapshot.bottomChrome);
    };

    update();
    return subscribeSafariVisualViewport(update);
  }, []);

  if (Platform.OS !== "web") {
    return (
      FEED_TAB_BAR_BASE_PX +
      Math.max(insets.bottom, spacing.sm) +
      OVERLAY_BOTTOM_SAFETY_MARGIN_PX +
      spacing.sm
    );
  }

  return padding;
}

export { computeFeedScrollBottomPadding };
