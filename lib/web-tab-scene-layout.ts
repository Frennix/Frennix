import { useEffect, useState } from "react";
import { Platform, useWindowDimensions, type ViewStyle } from "react-native";
import {
  measureSafariVisualViewport,
  requestSafariVisualViewportRemeasure,
  subscribeSafariVisualViewport,
  isMobileWeb,
} from "@/lib/safari-visual-viewport";

/** React Navigation header on web tab scenes. */
const WEB_APP_HEADER_PX = 52;

/** Bottom tab bar (excluding browser chrome — use visualViewport when available). */
const WEB_BOTTOM_TAB_BAR_PX = 56;

/** Legacy fallback when visualViewport is unavailable (desktop / older browsers). */
const WEB_TAB_CHROME_FALLBACK_PX = 140;

function measureTabSceneHeight(layoutHeight: number): number {
  if (Platform.OS !== "web") return 0;

  const effectiveLayout =
    layoutHeight > 0
      ? layoutHeight
      : typeof window !== "undefined"
        ? window.innerHeight
        : 0;
  if (effectiveLayout <= 0) return 320;

  const snap = measureSafariVisualViewport();
  const appChrome = WEB_APP_HEADER_PX + WEB_BOTTOM_TAB_BAR_PX;

  if (isMobileWeb() && typeof window !== "undefined" && window.visualViewport) {
    const visual = snap.visualHeight > 0 ? snap.visualHeight : effectiveLayout;
    return Math.max(Math.round(visual - appChrome), 240);
  }

  return Math.max(Math.round(effectiveLayout - WEB_TAB_CHROME_FALLBACK_PX), 240);
}

/**
 * Explicit tab-scene scroll height for RN Web / Safari.
 * Uses visualViewport on mobile so Safari toolbar expand/collapse does not leave dead space.
 */
export function useWebTabSceneHeight(): number | undefined {
  const { height: layoutHeight } = useWindowDimensions();
  const [sceneHeight, setSceneHeight] = useState<number | undefined>(() =>
    Platform.OS === "web" ? measureTabSceneHeight(layoutHeight) : undefined
  );
  const [viewportTick, setViewportTick] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    return subscribeSafariVisualViewport(() => {
      setViewportTick((tick) => tick + 1);
    });
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web" || layoutHeight <= 0) return;
    setSceneHeight(measureTabSceneHeight(layoutHeight));
  }, [layoutHeight, viewportTick]);

  if (Platform.OS !== "web") return undefined;
  if (layoutHeight <= 0) {
    return measureTabSceneHeight(
      typeof window !== "undefined" ? window.innerHeight : 0
    );
  }
  return sceneHeight ?? measureTabSceneHeight(layoutHeight);
}

/** Bounded scroll surface inside a tab scene (Safari web). */
export function webTabSceneHeightStyle(height: number | undefined): ViewStyle {
  if (height == null) return {};
  return {
    height,
    minHeight: 0,
    maxHeight: height,
    flex: 1,
    flexBasis: 0,
    flexGrow: 1,
    flexShrink: 1,
  };
}

/** Tab scene wrapper — flex-fill only; do not pin height (avoids dead/ clipped bands). */
export function webTabSceneContainerStyle(): ViewStyle {
  if (Platform.OS !== "web") return {};
  return {
    flex: 1,
    minHeight: 0,
    flexBasis: 0,
    width: "100%",
    overflow: "hidden",
  };
}

export { requestSafariVisualViewportRemeasure };
