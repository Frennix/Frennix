import { useEffect, useRef, useState } from "react";
import { Dimensions, Platform, type View } from "react-native";
import { MEDIA_AUTOPLAY_VISIBILITY_THRESHOLD } from "./useMediaVisibility";

/** Fraction of the video frame that must remain visible to keep playing. */
export const FEED_VIDEO_VISIBILITY_THRESHOLD = MEDIA_AUTOPLAY_VISIBILITY_THRESHOLD;

/**
 * Tracks whether a playing feed video remains meaningfully visible.
 * Web uses IntersectionObserver; native polls measureInWindow while monitoring is enabled.
 */
export function useFeedVideoViewportVisibility(enabled: boolean) {
  const containerRef = useRef<View>(null);
  const [isMostlyVisible, setIsMostlyVisible] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setIsMostlyVisible(true);
      return;
    }

    if (Platform.OS === "web" && typeof IntersectionObserver !== "undefined") {
      const node = containerRef.current as unknown as HTMLElement | null;
      if (!node) return;

      const observer = new IntersectionObserver(
        (entries) => {
          const ratio = entries[0]?.intersectionRatio ?? 0;
          setIsMostlyVisible(ratio >= FEED_VIDEO_VISIBILITY_THRESHOLD);
        },
        { threshold: [0, 0.25, 0.5, FEED_VIDEO_VISIBILITY_THRESHOLD, 0.75, 1] }
      );

      observer.observe(node);
      return () => observer.disconnect();
    }

    let mounted = true;

    const measureVisibility = () => {
      const view = containerRef.current;
      if (!view) return;

      view.measureInWindow((_x, y, _width, height) => {
        if (!mounted || height <= 0) return;

        const windowHeight = Dimensions.get("window").height;
        const visibleTop = Math.max(0, y);
        const visibleBottom = Math.min(windowHeight, y + height);
        const visibleHeight = Math.max(0, visibleBottom - visibleTop);
        const ratio = visibleHeight / height;

        setIsMostlyVisible(ratio >= FEED_VIDEO_VISIBILITY_THRESHOLD);
      });
    };

    measureVisibility();
    const interval = setInterval(measureVisibility, 200);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [enabled]);

  return { containerRef, isMostlyVisible };
}
