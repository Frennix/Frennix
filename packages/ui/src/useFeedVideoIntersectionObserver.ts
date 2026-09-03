import { useEffect, useRef, type RefObject } from "react";
import { Dimensions, Platform } from "react-native";

/** Pause feed video when less than 25% of it remains visible in the scrollport. */
export const FEED_VIDEO_VISIBILITY_THRESHOLD = 0.25;

/**
 * Expand the feed scroll root by one viewport height above and below so videos
 * begin preparing roughly one screen before they enter view.
 */
export const FEED_VIDEO_PRELOAD_ROOT_MARGIN = "100% 0px 100% 0px";

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

export type FeedVideoIntersectionObserverOptions = {
  onEnterPreloadZone?: () => void;
  onExitPreloadZone?: () => void;
  preloadRootMargin?: string;
};

/**
 * Observes a feed video against the feed scrollport (not the browser window).
 * Playback uses the visible scrollport with a 25% visibility threshold.
 * Optional preload callbacks fire when the element enters an expanded root margin.
 */
export function useFeedVideoIntersectionObserver(
  targetRef: RefObject<Element | null>,
  enabled: boolean,
  onBelowThreshold: () => void,
  onAboveThreshold?: () => void,
  /** When true while above threshold, fires enter even if IO already marked visible (fixes inView desync). */
  shouldEnterAbove?: () => boolean,
  options?: FeedVideoIntersectionObserverOptions
) {
  const onBelowThresholdRef = useRef(onBelowThreshold);
  onBelowThresholdRef.current = onBelowThreshold;
  const onAboveThresholdRef = useRef(onAboveThreshold);
  onAboveThresholdRef.current = onAboveThreshold;
  const shouldEnterAboveRef = useRef(shouldEnterAbove);
  shouldEnterAboveRef.current = shouldEnterAbove;
  const onEnterPreloadZoneRef = useRef(options?.onEnterPreloadZone);
  onEnterPreloadZoneRef.current = options?.onEnterPreloadZone;
  const onExitPreloadZoneRef = useRef(options?.onExitPreloadZone);
  onExitPreloadZoneRef.current = options?.onExitPreloadZone;
  const preloadRootMargin = options?.preloadRootMargin ?? FEED_VIDEO_PRELOAD_ROOT_MARGIN;
  const hasMetThresholdRef = useRef(false);
  const inPreloadZoneRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      hasMetThresholdRef.current = false;
      if (inPreloadZoneRef.current) {
        inPreloadZoneRef.current = false;
        onExitPreloadZoneRef.current?.();
      }
      return;
    }

    if (Platform.OS === "web" && typeof IntersectionObserver !== "undefined") {
      let playbackObserver: IntersectionObserver | null = null;
      let preloadObserver: IntersectionObserver | null = null;
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

        playbackObserver = new IntersectionObserver(
          (entries) => {
            const entry = entries[0];
            if (!entry) return;

            const ratio = entry.intersectionRatio;
            const belowThreshold =
              !entry.isIntersecting || ratio < FEED_VIDEO_VISIBILITY_THRESHOLD;

            if (!belowThreshold) {
              const wasBelow = !hasMetThresholdRef.current;
              hasMetThresholdRef.current = true;
              const needsEnter = wasBelow || shouldEnterAboveRef.current?.() === true;
              if (needsEnter) {
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

        playbackObserver.observe(target);

        if (onEnterPreloadZoneRef.current || onExitPreloadZoneRef.current) {
          preloadObserver = new IntersectionObserver(
            (entries) => {
              const entry = entries[0];
              if (!entry) return;
              const inZone = entry.isIntersecting;
              if (inZone && !inPreloadZoneRef.current) {
                inPreloadZoneRef.current = true;
                onEnterPreloadZoneRef.current?.();
              } else if (!inZone && inPreloadZoneRef.current) {
                inPreloadZoneRef.current = false;
                onExitPreloadZoneRef.current?.();
              }
            },
            {
              root,
              rootMargin: preloadRootMargin,
              threshold: [0, 0.01],
            }
          );
          preloadObserver.observe(target);
        }
      };

      attach();

      return () => {
        cancelled = true;
        cancelAnimationFrame(rafId);
        playbackObserver?.disconnect();
        preloadObserver?.disconnect();
        if (inPreloadZoneRef.current) {
          inPreloadZoneRef.current = false;
          onExitPreloadZoneRef.current?.();
        }
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

          const preloadMargin = rootRect.height;
          const inPreloadZone =
            targetBottom > rootRect.top - preloadMargin &&
            targetTop < rootRect.bottom + preloadMargin;
          if (inPreloadZone && !inPreloadZoneRef.current) {
            inPreloadZoneRef.current = true;
            onEnterPreloadZoneRef.current?.();
          } else if (!inPreloadZone && inPreloadZoneRef.current) {
            inPreloadZoneRef.current = false;
            onExitPreloadZoneRef.current?.();
          }

          const aboveThreshold =
            entryIsVisibleInRoot(targetTop, targetBottom, rootRect) &&
            ratio >= FEED_VIDEO_VISIBILITY_THRESHOLD;

          if (aboveThreshold) {
            const wasBelow = !hasMetThresholdRef.current;
            hasMetThresholdRef.current = true;
            const needsEnter = wasBelow || shouldEnterAboveRef.current?.() === true;
            if (needsEnter) {
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

        const inPreloadZone =
          y + height > -windowHeight && y < windowHeight * 2;
        if (inPreloadZone && !inPreloadZoneRef.current) {
          inPreloadZoneRef.current = true;
          onEnterPreloadZoneRef.current?.();
        } else if (!inPreloadZone && inPreloadZoneRef.current) {
          inPreloadZoneRef.current = false;
          onExitPreloadZoneRef.current?.();
        }

        if (ratio >= FEED_VIDEO_VISIBILITY_THRESHOLD) {
          const wasBelow = !hasMetThresholdRef.current;
          hasMetThresholdRef.current = true;
          const needsEnter = wasBelow || shouldEnterAboveRef.current?.() === true;
          if (needsEnter) {
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
      if (inPreloadZoneRef.current) {
        inPreloadZoneRef.current = false;
        onExitPreloadZoneRef.current?.();
      }
    };
  }, [enabled, preloadRootMargin, targetRef]);
}

function entryIsVisibleInRoot(
  targetTop: number,
  targetBottom: number,
  rootRect: DOMRect
): boolean {
  return targetBottom > rootRect.top && targetTop < rootRect.bottom;
}
