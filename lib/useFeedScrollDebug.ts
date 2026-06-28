import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Platform } from "react-native";
import { isFeedScrollDebugEnabled } from "@/lib/feed-scroll-debug";

export type FeedScrollDebugSnapshot = {
  scrollable: boolean;
  contentHeight: number;
  listLayoutHeight: number;
  viewportHeight: number;
  scrollEnabled: boolean;
  /** True if onScroll fired within the last 3 seconds. */
  scrollEventsFiring: boolean;
  lastScrollOffsetY: number | null;
  lastScrollAt: number | null;
  lastTouchTarget: string;
  lastTouchAt: number | null;
  /** Full-screen element likely blocking feed touches. */
  blockingOverlay: string | null;
  mountedOverlays: string[];
  scrollContainerSummary: string;
  bodyOverflow: string;
  gestureHandlerSuspect: string | null;
  storyVisible: boolean;
  shareSheetVisible: boolean;
  lightboxVisible: boolean;
};

const EMPTY_SNAPSHOT: FeedScrollDebugSnapshot = {
  scrollable: false,
  contentHeight: 0,
  listLayoutHeight: 0,
  viewportHeight: 0,
  scrollEnabled: true,
  scrollEventsFiring: false,
  lastScrollOffsetY: null,
  lastScrollAt: null,
  lastTouchTarget: "—",
  lastTouchAt: null,
  blockingOverlay: null,
  mountedOverlays: [],
  scrollContainerSummary: "—",
  bodyOverflow: "—",
  gestureHandlerSuspect: null,
  storyVisible: false,
  shareSheetVisible: false,
  lightboxVisible: false,
};

function describeElement(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const rawClass = el.className?.toString?.() ?? "";
  const firstClass = rawClass.split(/\s+/).find(Boolean);
  const classPart = firstClass ? `.${firstClass.slice(0, 40)}` : "";
  const role = el.getAttribute("role");
  const aria = el.getAttribute("aria-label");
  const testId = el.getAttribute("data-testid");
  const extras = [role && `role=${role}`, aria && `aria=${aria.slice(0, 24)}`, testId && `testid=${testId}`]
    .filter(Boolean)
    .join(" ");
  return `${tag}${id}${classPart}${extras ? ` (${extras})` : ""}`;
}

function isGestureHandlerNode(el: Element): boolean {
  const cls = el.className?.toString?.() ?? "";
  if (/gesture|rngesture|reanimated/i.test(cls)) return true;
  const style = getComputedStyle(el);
  if (style.touchAction === "none" && el.tagName !== "HTML" && el.tagName !== "BODY") {
    const rect = el.getBoundingClientRect();
    if (rect.width >= window.innerWidth * 0.5 && rect.height >= window.innerHeight * 0.3) {
      return true;
    }
  }
  return false;
}

function scanDomOverlays() {
  if (typeof document === "undefined") {
    return { mountedOverlays: [] as string[], blockingOverlay: null as string | null, gestureHandlerSuspect: null as string | null };
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const mountedOverlays: string[] = [];
  let blockingOverlay: string | null = null;
  let gestureHandlerSuspect: string | null = null;

  const nodes = document.querySelectorAll("body *");
  nodes.forEach((el) => {
    if (el.closest("[data-feed-scroll-debug]")) return;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return;
    const opacity = parseFloat(style.opacity);
    if (!Number.isNaN(opacity) && opacity < 0.05) return;
    if (style.pointerEvents === "none") return;

    const rect = el.getBoundingClientRect();
    if (rect.width < vw * 0.85 || rect.height < vh * 0.85) {
      if (isGestureHandlerNode(el) && !gestureHandlerSuspect) {
        gestureHandlerSuspect = describeElement(el);
      }
      return;
    }

    const positioned = style.position === "fixed" || style.position === "absolute" || style.position === "sticky";
    const zIndex = parseInt(style.zIndex, 10);
    const highStack = !Number.isNaN(zIndex) && zIndex >= 1;

    if (positioned || highStack) {
      const label = describeElement(el);
      mountedOverlays.push(`${label} z=${style.zIndex || "auto"} pe=${style.pointerEvents}`);
      if (!blockingOverlay && style.pointerEvents !== "none") {
        blockingOverlay = label;
      }
    }

    if (isGestureHandlerNode(el) && !gestureHandlerSuspect) {
      gestureHandlerSuspect = describeElement(el);
    }
  });

  return {
    mountedOverlays: mountedOverlays.slice(0, 8),
    blockingOverlay,
    gestureHandlerSuspect,
  };
}

function readScrollContainer(listRef: { getNativeScrollRef?: () => unknown } | null): string {
  const scrollNode = listRef?.getNativeScrollRef?.() as HTMLElement | undefined;
  if (!scrollNode || typeof scrollNode !== "object") return "scroll ref missing";
  const style = getComputedStyle(scrollNode);
  return `client=${scrollNode.clientHeight} scroll=${scrollNode.scrollHeight} overflowY=${style.overflowY} touch=${style.touchAction}`;
}

type UseFeedScrollDebugOptions = {
  listRef: RefObject<{ getNativeScrollRef?: () => unknown } | null>;
  scrollEnabled: boolean;
  storyVisible: boolean;
  shareSheetVisible: boolean;
  lightboxVisible: boolean;
  viewportHeight: number;
};

export function useFeedScrollDebug({
  listRef,
  scrollEnabled,
  storyVisible,
  shareSheetVisible,
  lightboxVisible,
  viewportHeight,
}: UseFeedScrollDebugOptions) {
  const enabled = isFeedScrollDebugEnabled();
  const [snapshot, setSnapshot] = useState<FeedScrollDebugSnapshot>(EMPTY_SNAPSHOT);
  const metricsRef = useRef({ contentHeight: 0, listLayoutHeight: 0 });
  const lastScrollAtRef = useRef<number | null>(null);
  const lastScrollOffsetRef = useRef<number | null>(null);
  const lastTouchTargetRef = useRef("—");
  const lastTouchAtRef = useRef<number | null>(null);

  const refreshSnapshot = useCallback(() => {
    if (!enabled) return;

    const { contentHeight, listLayoutHeight } = metricsRef.current;
    const scrollable = contentHeight > listLayoutHeight + 1;
    const domScan = scanDomOverlays();
    const now = Date.now();
    const lastScrollAt = lastScrollAtRef.current;
    const scrollEventsFiring = lastScrollAt != null && now - lastScrollAt < 3000;

    setSnapshot({
      scrollable,
      contentHeight: Math.round(contentHeight),
      listLayoutHeight: Math.round(listLayoutHeight),
      viewportHeight: Math.round(viewportHeight),
      scrollEnabled,
      scrollEventsFiring,
      lastScrollOffsetY: lastScrollOffsetRef.current,
      lastScrollAt,
      lastTouchTarget: lastTouchTargetRef.current,
      lastTouchAt: lastTouchAtRef.current,
      blockingOverlay: domScan.blockingOverlay,
      mountedOverlays: domScan.mountedOverlays,
      scrollContainerSummary: readScrollContainer(listRef.current),
      bodyOverflow: typeof document !== "undefined" ? getComputedStyle(document.body).overflow : "—",
      gestureHandlerSuspect: domScan.gestureHandlerSuspect,
      storyVisible,
      shareSheetVisible,
      lightboxVisible,
    });
  }, [enabled, listRef, scrollEnabled, storyVisible, shareSheetVisible, lightboxVisible, viewportHeight]);

  const reportMetrics = useCallback(
    (listLayoutHeight: number, contentHeight: number) => {
      if (!enabled) return;
      metricsRef.current = { listLayoutHeight, contentHeight };
      refreshSnapshot();
    },
    [enabled, refreshSnapshot]
  );

  const reportScroll = useCallback(
    (offsetY: number) => {
      if (!enabled) return;
      lastScrollAtRef.current = Date.now();
      lastScrollOffsetRef.current = Math.round(offsetY);
      refreshSnapshot();
    },
    [enabled, refreshSnapshot]
  );

  useEffect(() => {
    if (!enabled || Platform.OS !== "web" || typeof document === "undefined") return;

    const onTouch = (event: TouchEvent) => {
      const target = event.target;
      const label = target instanceof Element ? describeElement(target) : "unknown";
      lastTouchTargetRef.current = label;
      lastTouchAtRef.current = Date.now();
      refreshSnapshot();
    };

    document.addEventListener("touchstart", onTouch, { capture: true, passive: true });
    return () => document.removeEventListener("touchstart", onTouch, { capture: true });
  }, [enabled, refreshSnapshot]);

  useEffect(() => {
    if (!enabled) return;
    refreshSnapshot();
    const timer = setInterval(refreshSnapshot, 1500);
    return () => clearInterval(timer);
  }, [enabled, refreshSnapshot]);

  return { enabled, snapshot, reportMetrics, reportScroll };
}
