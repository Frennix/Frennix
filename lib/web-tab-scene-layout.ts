import { useEffect, useState } from "react";
import { Platform, useWindowDimensions, type ViewStyle } from "react-native";

/** React Navigation header on web tab scenes. */
const WEB_APP_HEADER_PX = 52;

/** Bottom tab bar (excluding browser chrome — use visualViewport when available). */
const WEB_BOTTOM_TAB_BAR_PX = 56;

/** Legacy fallback when visualViewport is unavailable (desktop / older browsers). */
const WEB_TAB_CHROME_FALLBACK_PX = 140;

function isMobileWeb(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /Android|iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function measureTabSceneHeight(layoutHeight: number): number {
  if (Platform.OS !== "web" || layoutHeight <= 0) return 0;

  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  const appChrome = WEB_APP_HEADER_PX + WEB_BOTTOM_TAB_BAR_PX;

  if (vv && isMobileWeb()) {
    return Math.max(Math.round(vv.height - appChrome), 240);
  }

  return Math.max(Math.round(layoutHeight - WEB_TAB_CHROME_FALLBACK_PX), 240);
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

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || layoutHeight <= 0) return;

    const update = () => {
      const next = measureTabSceneHeight(layoutHeight);
      setSceneHeight((prev) => (prev === next ? prev : next));
    };

    update();
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    return () => {
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, [layoutHeight]);

  if (Platform.OS !== "web" || layoutHeight <= 0) return undefined;
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
