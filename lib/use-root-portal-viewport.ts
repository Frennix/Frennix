import { useEffect, useState } from "react";
import { Platform } from "react-native";
import {
  measureSafariVisualViewport,
  requestSafariVisualViewportRemeasure,
  subscribeSafariVisualViewport,
  type SafariVisualViewportSnapshot,
} from "@/lib/safari-visual-viewport";

/** Visual viewport bounds for fixed root portals (Safari toolbar / PWA safe area). */
export function useRootPortalViewport(active: boolean) {
  const [viewport, setViewport] = useState<SafariVisualViewportSnapshot | null>(() =>
    Platform.OS === "web" ? measureSafariVisualViewport() : null
  );

  useEffect(() => {
    if (Platform.OS !== "web" || !active) return;
    requestSafariVisualViewportRemeasure();
    return subscribeSafariVisualViewport(setViewport);
  }, [active]);

  const overlayTop = Platform.OS === "web" ? (viewport?.offsetTop ?? 0) : 0;
  const overlayHeight =
    Platform.OS === "web"
      ? (viewport?.overlayHeight ?? (typeof window !== "undefined" ? window.innerHeight : 640))
      : undefined;

  return { overlayTop, overlayHeight };
}
