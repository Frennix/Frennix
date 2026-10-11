import { useEffect, useState } from "react";
import { Platform } from "react-native";
import {
  measureSafariVisualViewport,
  requestSafariVisualViewportRemeasure,
  subscribeSafariVisualViewport,
  type SafariVisualViewportSnapshot,
} from "@/lib/safari-visual-viewport";

function readViewportSnapshot(): SafariVisualViewportSnapshot {
  return measureSafariVisualViewport();
}

/** Visual viewport bounds for fixed root portals (Safari toolbar / PWA safe area). */
export function useRootPortalViewport(active: boolean) {
  const [viewport, setViewport] = useState<SafariVisualViewportSnapshot | null>(() =>
    Platform.OS === "web" ? readViewportSnapshot() : null
  );

  useEffect(() => {
    if (Platform.OS !== "web" || !active) return;

    const sync = () => {
      setViewport(readViewportSnapshot());
    };

    const syncAfterViewportSettles = () => {
      sync();
      requestAnimationFrame(() => {
        sync();
        requestAnimationFrame(sync);
      });
    };

    requestSafariVisualViewportRemeasure();
    syncAfterViewportSettles();

    const unsubViewport = subscribeSafariVisualViewport(syncAfterViewportSettles);
    document.addEventListener("focusin", syncAfterViewportSettles);
    document.addEventListener("focusout", syncAfterViewportSettles);

    return () => {
      unsubViewport();
      document.removeEventListener("focusin", syncAfterViewportSettles);
      document.removeEventListener("focusout", syncAfterViewportSettles);
    };
  }, [active]);

  const overlayTop = Platform.OS === "web" ? (viewport?.offsetTop ?? 0) : 0;
  const overlayHeight =
    Platform.OS === "web"
      ? (viewport?.overlayHeight ?? (typeof window !== "undefined" ? window.innerHeight : 640))
      : undefined;
  /** Gap from visual viewport bottom to layout viewport bottom (keyboard / Safari chrome). */
  const overlayBottomInset = Platform.OS === "web" ? (viewport?.bottomChrome ?? 0) : 0;

  return { overlayTop, overlayHeight, overlayBottomInset };
}
