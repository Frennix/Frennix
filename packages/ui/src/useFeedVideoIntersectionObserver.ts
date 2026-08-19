import { useEffect, useRef, type RefObject } from "react";
import { Dimensions, Platform } from "react-native";

/** Pause feed video when less than 25% of it remains visible in the scrollport. */
export const FEED_VIDEO_VISIBILITY_THRESHOLD = 0.25;

/** Home feed scroll container — IntersectionObserver root on web/PWA. */
export const FEED_SCROLL_ROOT_ID = "feed-scroll-list";

function resolveFeedScrollRoot(): Element | null {
  if (typeof document === "undefined") return null;
  return document.getElementById(FEED_SCROLL_ROOT_ID);
}

function resolveDomNode(ref: RefObject<unknown>): Element | null {
  const current = ref.current;
  if (!current) return null;
  if (current instanceof Element) return current;
  const maybeNode = current as { getNativeScrollRef?: () => Element | null };
  if (typeof maybeNode.getNativeScrollRef === "function") {
    const nativeNode = maybeNode.getNativeScrollRef();
    if (nativeNode instanceof Element) return nativeNode;
  }
  return null;
}

/**
 * Observes a feed video against the feed scrollport (not the browser window).
 * Calls onAboveThreshold when visibility crosses upward past the threshold (autoplay).
 * Calls onBelowThreshold synchronously when visibility drops — callers must pause media there.
 */
export function useFeedVideoIntersectionObserver(
  targetRef: RefObject<Element | null>,
  enabled: boolean,
  onBelowThreshold: () => void,
  onAboveThreshold?: () => void
) {
  const onBelowThresholdRef = useRef(onBelowThreshold);
  onBelowThresholdRef.current = onBelowThreshold;
  const onAboveThresholdRef = useRef(onAboveThreshold);
  onAboveThresholdRef.current = onAboveThreshold;
  const hasMetThresholdRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      hasMetThresholdRef.current = false;
      return;
    }

    if (Platform.OS === "web" && typeof IntersectionObserver !== "undefined") {
      let observer: IntersectionObserver | null = null;
      let rafId = 0;
      let cancelled = false;

      const attach = () => {
        if (cancelled) return;

        const target = resolveDomNode(targetRef);
        if (!target) {
          rafId = requestAnimationFrame(attach);
          return;
        }

        const root = resolveFeedScrollRoot();
        if (!root) {
          rafId = requestAnimationFrame(attach);
          return;
        }

        observer = new IntersectionObserver(
          (entries) => {
            const entry = entries[0];
            if (!entry) return;

            const ratio = entry.intersectionRatio;
            const belowThreshold =
              !entry.isIntersecting || ratio < FEED_VIDEO_VISIBILITY_THRESHOLD;

            if (!belowThreshold) {
              const wasBelow = !hasMetThresholdRef.current;
              hasMetThresholdRef.current = true;
              if (wasBelow) {
                onAboveThresholdRef.current?.();
              }
              return;
            }

            if (hasMetThresholdRef.current) {
              hasMetThresholdRef.current = false;
              onBelowThresholdRef.current();
            }
          },
          {
            root,
            rootMargin: "0px",
            threshold: [0, 0.01, 0.1, FEED_VIDEO_VISIBILITY_THRESHOLD, 0.5, 0.75, 1],
          }
        );

        observer.observe(target);
      };

      attach();

      return () => {
        cancelled = true;
        cancelAnimationFrame(rafId);
        observer?.disconnect();
      };
    }

    let mounted = true;
    let interval: ReturnType<typeof setInterval> | null = null;

    const measureVisibility = () => {
      const target = targetRef.current as {
        measureInWindow?: (
          callback: (x: number, y: number, width: number, height: number) => void
        ) => void;
      } | null;

      if (!target?.measureInWindow) return;

      target.measureInWindow((_x, y, _width, height) => {
        if (!mounted || height <= 0) return;

        const root = resolveFeedScrollRoot();
        if (root && typeof root.getBoundingClientRect === "function") {
          const rootRect = root.getBoundingClientRect();
          const targetTop = y;
          const targetBottom = y + height;
          const visibleTop = Math.max(rootRect.top, targetTop);
          const visibleBottom = Math.min(rootRect.bottom, targetBottom);
          const visibleHeight = Math.max(0, visibleBottom - visibleTop);
          const ratio = visibleHeight / height;

          const aboveThreshold =
            entryIsVisibleInRoot(targetTop, targetBottom, rootRect) &&
            ratio >= FEED_VIDEO_VISIBILITY_THRESHOLD;

          if (aboveThreshold) {
            const wasBelow = !hasMetThresholdRef.current;
            hasMetThresholdRef.current = true;
            if (wasBelow) {
              onAboveThresholdRef.current?.();
            }
            return;
          }

          if (hasMetThresholdRef.current) {
            hasMetThresholdRef.current = false;
            onBelowThresholdRef.current();
          }
          return;
        }

        const windowHeight = Dimensions.get("window").height;
        const visibleTop = Math.max(0, y);
        const visibleBottom = Math.min(windowHeight, y + height);
        const visibleHeight = Math.max(0, visibleBottom - visibleTop);
        const ratio = visibleHeight / height;

        if (ratio >= FEED_VIDEO_VISIBILITY_THRESHOLD) {
          const wasBelow = !hasMetThresholdRef.current;
          hasMetThresholdRef.current = true;
          if (wasBelow) {
            onAboveThresholdRef.current?.();
          }
          return;
        }

        if (hasMetThresholdRef.current) {
          hasMetThresholdRef.current = false;
          onBelowThresholdRef.current();
        }
      });
    };

    measureVisibility();
    interval = setInterval(measureVisibility, 150);

    return () => {
      mounted = false;
      if (interval) clearInterval(interval);
    };
  }, [enabled, targetRef]);
}

function entryIsVisibleInRoot(
  targetTop: number,
  targetBottom: number,
  rootRect: DOMRect
): boolean {
  return targetBottom > rootRect.top && targetTop < rootRect.bottom;
}
