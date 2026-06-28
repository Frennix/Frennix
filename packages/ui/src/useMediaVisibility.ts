import { useEffect, useRef, useState } from "react";
import { Platform, type View } from "react-native";

/** Fraction of the element that must be visible before autoplay (matches Instagram-style feed). */
export const MEDIA_AUTOPLAY_VISIBILITY_THRESHOLD = 0.6;

/**
 * Tracks whether media is mostly visible in the viewport.
 * Native feed rows pass `externallyVisible` from FlatList viewability;
 * web uses IntersectionObserver as a second gate.
 */
export function useMediaVisibility(externallyVisible: boolean) {
  const containerRef = useRef<View>(null);
  const [intersectionVisible, setIntersectionVisible] = useState(externallyVisible);

  useEffect(() => {
    if (!externallyVisible) {
      setIntersectionVisible(false);
      return;
    }

    if (Platform.OS !== "web" || typeof document === "undefined") {
      setIntersectionVisible(true);
      return;
    }

    const node = containerRef.current as unknown as HTMLElement | null;
    if (!node || typeof IntersectionObserver === "undefined") {
      setIntersectionVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const ratio = entries[0]?.intersectionRatio ?? 0;
        setIntersectionVisible(ratio >= MEDIA_AUTOPLAY_VISIBILITY_THRESHOLD);
      },
      { threshold: [0, MEDIA_AUTOPLAY_VISIBILITY_THRESHOLD, 1] }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [externallyVisible]);

  const isMostlyVisible = externallyVisible && intersectionVisible;

  return { containerRef, isMostlyVisible };
}
