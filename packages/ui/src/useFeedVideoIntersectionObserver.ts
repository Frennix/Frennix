import { useEffect, useRef, type RefObject } from "react";
import { Dimensions, Platform } from "react-native";
import {
  isFeedVideoDebugEnabled,
  logFeedVideo,
  recordFeedVideoIoAttached,
  recordFeedVideoIoCallback,
} from "./feedVideoPlaybackDebug";

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

function describeRoot(root: Element | null) {
  if (!root || typeof root.getBoundingClientRect !== "function") return null;
  const rect = root.getBoundingClientRect();
  const htmlRoot = root as HTMLElement;
  const style = typeof getComputedStyle !== "undefined" ? getComputedStyle(root) : null;
  return {
    id: root.id || null,
    tag: root.tagName,
    rect: {
      top: Math.round(rect.top),
      bottom: Math.round(rect.bottom),
      height: Math.round(rect.height),
    },
    scrollTop: htmlRoot.scrollTop ?? null,
    scrollHeight: htmlRoot.scrollHeight ?? null,
    clientHeight: htmlRoot.clientHeight ?? null,
    overflowY: style?.overflowY ?? null,
  };
}

/**
 * Observes a playing feed video against the feed scrollport (not the browser window).
 * Calls onBelowThreshold synchronously from the observer — callers must pause media there.
 */
export function useFeedVideoIntersectionObserver(
  targetRef: RefObject<Element | null>,
  enabled: boolean,
  onBelowThreshold: () => void,
  playbackId?: string
) {
  const onBelowThresholdRef = useRef(onBelowThreshold);
  onBelowThresholdRef.current = onBelowThreshold;
  const hasMetThresholdRef = useRef(false);
  const attachAttemptsRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      hasMetThresholdRef.current = false;
      if (isFeedVideoDebugEnabled()) {
        logFeedVideo("io-disabled", playbackId, { enabled: false });
      }
      return;
    }

    if (Platform.OS === "web" && typeof IntersectionObserver !== "undefined") {
      let observer: IntersectionObserver | null = null;
      let rafId = 0;
      let cancelled = false;

      const attach = () => {
        if (cancelled) return;
        attachAttemptsRef.current += 1;

        const target = resolveDomNode(targetRef);
        if (!target) {
          if (isFeedVideoDebugEnabled() && attachAttemptsRef.current % 30 === 1) {
            logFeedVideo("io-attach-miss", playbackId, {
              reason: "target-not-found",
              attempts: attachAttemptsRef.current,
              targetIsVideo: targetRef.current instanceof HTMLVideoElement,
            });
          }
          rafId = requestAnimationFrame(attach);
          return;
        }

        const root = resolveFeedScrollRoot();
        if (!root) {
          if (isFeedVideoDebugEnabled() && attachAttemptsRef.current % 30 === 1) {
            logFeedVideo("io-attach-miss", playbackId, {
              reason: "feed-scroll-root-not-found",
              attempts: attachAttemptsRef.current,
              feedScrollRootId: FEED_SCROLL_ROOT_ID,
            });
          }
          rafId = requestAnimationFrame(attach);
          return;
        }

        if (isFeedVideoDebugEnabled()) {
          logFeedVideo("io-attached", playbackId, {
            attempts: attachAttemptsRef.current,
            targetTag: target.tagName,
            targetId: target.id || null,
            root: describeRoot(root),
            threshold: FEED_VIDEO_VISIBILITY_THRESHOLD,
          });
        }
        recordFeedVideoIoAttached(root);

        observer = new IntersectionObserver(
          (entries) => {
            const entry = entries[0];
            if (!entry) return;

            const ratio = entry.intersectionRatio;
            const belowThreshold =
              !entry.isIntersecting || ratio < FEED_VIDEO_VISIBILITY_THRESHOLD;
            const ioRoot = entry.root instanceof Element ? entry.root : root;

            recordFeedVideoIoCallback({
              playbackId,
              intersectionRatio: ratio,
              isIntersecting: entry.isIntersecting,
              belowThreshold,
              hasMetThreshold: hasMetThresholdRef.current,
              root: ioRoot,
            });

            if (isFeedVideoDebugEnabled()) {
              logFeedVideo("io-callback", playbackId, {
                intersectionRatio: ratio,
                isIntersecting: entry.isIntersecting,
                belowThreshold,
                hasMetThreshold: hasMetThresholdRef.current,
                root: describeRoot(entry.root instanceof Element ? entry.root : root),
                boundingClientRect: {
                  top: Math.round(entry.boundingClientRect.top),
                  bottom: Math.round(entry.boundingClientRect.bottom),
                  height: Math.round(entry.boundingClientRect.height),
                },
                rootBounds: entry.rootBounds
                  ? {
                      top: Math.round(entry.rootBounds.top),
                      bottom: Math.round(entry.rootBounds.bottom),
                      height: Math.round(entry.rootBounds.height),
                    }
                  : null,
              });
            }

            if (!belowThreshold) {
              hasMetThresholdRef.current = true;
              return;
            }

            if (hasMetThresholdRef.current) {
              hasMetThresholdRef.current = false;
              if (isFeedVideoDebugEnabled()) {
                logFeedVideo("scroll-out-trigger", playbackId, {
                  source: "intersection-observer",
                  intersectionRatio: ratio,
                  isIntersecting: entry.isIntersecting,
                });
              }
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

          if (!entryIsVisibleInRoot(targetTop, targetBottom, rootRect) || ratio < FEED_VIDEO_VISIBILITY_THRESHOLD) {
            if (ratio >= FEED_VIDEO_VISIBILITY_THRESHOLD && entryIsVisibleInRoot(targetTop, targetBottom, rootRect)) {
              hasMetThresholdRef.current = true;
              return;
            }
            if (hasMetThresholdRef.current) {
              hasMetThresholdRef.current = false;
              onBelowThresholdRef.current();
            }
            return;
          }

          hasMetThresholdRef.current = true;
          return;
        }

        const windowHeight = Dimensions.get("window").height;
        const visibleTop = Math.max(0, y);
        const visibleBottom = Math.min(windowHeight, y + height);
        const visibleHeight = Math.max(0, visibleBottom - visibleTop);
        const ratio = visibleHeight / height;

        if (ratio >= FEED_VIDEO_VISIBILITY_THRESHOLD) {
          hasMetThresholdRef.current = true;
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
  }, [enabled, targetRef, playbackId]);
}

function entryIsVisibleInRoot(
  targetTop: number,
  targetBottom: number,
  rootRect: DOMRect
): boolean {
  return targetBottom > rootRect.top && targetTop < rootRect.bottom;
}
