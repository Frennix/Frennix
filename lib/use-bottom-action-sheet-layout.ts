import { useEffect, useMemo, useState } from "react";
import { Platform, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "@frennix/ui";

/** Comfortable spacing above iOS safe area / Safari toolbar — see BUG-002. */
export const BOTTOM_SHEET_SAFETY_MARGIN_PX = 28;

/** Legacy viewport snap — only used when contentSized is false. */
export const BOTTOM_SHEET_PRIMARY_SNAP_RATIO = 0.68;

/** Taller snap when expanded content is shown. */
export const BOTTOM_SHEET_EXPANDED_SNAP_RATIO = 0.72;

/** Max height when expanded content needs to scroll. */
export const BOTTOM_SHEET_EXPANDED_MAX_RATIO = 0.85;

/** Soft cap for content-sized sheets before scrolling kicks in. */
export const BOTTOM_SHEET_CONTENT_MAX_RATIO = 0.88;

/** Extra lift so bottom-row actions clear iPhone Safari bottom toolbar. */
export const BOTTOM_SHEET_EXTRA_LIFT_PX = 32;

/** Reserve when visualViewport does not shrink for Safari bottom chrome (~44–56px + buffer). */
export const IOS_SAFARI_TOOLBAR_RESERVE_PX = 72;

const WEB_SAFE_AREA_PROBE_ID = "frennix-bottom-sheet-safe-area-probe";

type SheetLayoutState = {
  top: number;
  overlayHeight: number;
  sheetBottom: number;
};

export type BottomActionSheetLayoutOptions = {
  expanded?: boolean;
  /** Size sheet to its content instead of a fixed viewport snap. Default: true when not expanded. */
  contentSized?: boolean;
  primarySnapRatio?: number;
  expandedSnapRatio?: number;
  expandedMaxRatio?: number;
  contentMaxRatio?: number;
};

function readCssSafeAreaBottom(): number {
  if (typeof document === "undefined") return 0;

  let probe = document.getElementById(WEB_SAFE_AREA_PROBE_ID);
  if (!probe) {
    probe = document.createElement("div");
    probe.id = WEB_SAFE_AREA_PROBE_ID;
    probe.style.cssText =
      "position:fixed;bottom:0;left:0;width:0;height:0;padding-bottom:env(safe-area-inset-bottom,0px);visibility:hidden;pointer-events:none;";
    document.body.appendChild(probe);
  }

  const parsed = Number.parseFloat(getComputedStyle(probe).paddingBottom);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isMobileWebSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|Chrome|Chromium/i.test(ua);
  return isIOS && isSafari;
}

function readVisualViewportBottomChrome(): number {
  if (typeof window === "undefined" || !window.visualViewport) return 0;
  const vv = window.visualViewport;
  const gap = window.innerHeight - vv.offsetTop - vv.height;
  return Math.max(0, Math.round(gap));
}

function measureSheetLayout(): SheetLayoutState {
  const layoutHeight = typeof window !== "undefined" ? window.innerHeight : 0;
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  const envBottom = readCssSafeAreaBottom();
  const toolbarChrome = readVisualViewportBottomChrome();
  const safari = isMobileWebSafari();

  const toolbarReserve = safari
    ? Math.max(toolbarChrome, IOS_SAFARI_TOOLBAR_RESERVE_PX)
    : toolbarChrome;

  const sheetBottom = safari
    ? toolbarReserve + BOTTOM_SHEET_SAFETY_MARGIN_PX + BOTTOM_SHEET_EXTRA_LIFT_PX
    : envBottom + BOTTOM_SHEET_SAFETY_MARGIN_PX + BOTTOM_SHEET_EXTRA_LIFT_PX + toolbarChrome;

  const top = vv ? Math.round(vv.offsetTop) : 0;
  const vvHeight = vv ? Math.round(vv.height) : layoutHeight;
  const overlayHeight = Math.max(
    safari ? Math.min(vvHeight, layoutHeight - toolbarReserve) : vvHeight,
    180
  );

  return { top, overlayHeight, sheetBottom };
}

export type BottomActionSheetLayout = {
  sheetMarginBottom: number;
  contentBottomPadding: number;
  /** Fixed open height — omitted when contentSized. */
  sheetSnapHeight: number | string | undefined;
  sheetMaxHeight: number | string;
  /** Ratio used as animation fallback before layout measurement. */
  snapRatio: number;
  contentSized: boolean;
  webOverlayStyle: ViewStyle | null;
  webSheetAnchorStyle: ViewStyle | null;
};

/**
 * Safari-safe layout for native-style bottom action sheets — active only while the sheet is open.
 * Do not use app-wide (see BUG-002); scope to individual sheet instances.
 */
export function useBottomActionSheetLayout(
  visible: boolean,
  options: BottomActionSheetLayoutOptions = {}
): BottomActionSheetLayout {
  const {
    expanded = false,
    contentSized = !expanded,
    primarySnapRatio = BOTTOM_SHEET_PRIMARY_SNAP_RATIO,
    expandedSnapRatio = BOTTOM_SHEET_EXPANDED_SNAP_RATIO,
    expandedMaxRatio = BOTTOM_SHEET_EXPANDED_MAX_RATIO,
    contentMaxRatio = BOTTOM_SHEET_CONTENT_MAX_RATIO,
  } = options;

  const insets = useSafeAreaInsets();
  const [layout, setLayout] = useState<SheetLayoutState>(() =>
    Platform.OS === "web"
      ? measureSheetLayout()
      : { top: 0, overlayHeight: 0, sheetBottom: spacing.lg }
  );

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || !visible) return;

    const update = () => {
      const next = measureSheetLayout();
      setLayout((prev) =>
        prev.top === next.top &&
        prev.overlayHeight === next.overlayHeight &&
        prev.sheetBottom === next.sheetBottom
          ? prev
          : next
      );
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
  }, [visible]);

  const useWebSafariLayout =
    Platform.OS === "web" &&
    visible &&
    isMobileWebSafari() &&
    typeof window !== "undefined";

  const webOverlayStyle = useMemo(
    () =>
      useWebSafariLayout
        ? ({
            position: "fixed",
            top: layout.top,
            left: 0,
            right: 0,
            width: "100%",
            height: layout.overlayHeight,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            overflow: "hidden",
          } as ViewStyle)
        : null,
    [useWebSafariLayout, layout.top, layout.overlayHeight]
  );

  const webSheetAnchorStyle = useMemo(
    () =>
      useWebSafariLayout
        ? ({
            width: "100%",
            marginBottom: layout.sheetBottom,
            flexShrink: 0,
          } as ViewStyle)
        : null,
    [useWebSafariLayout, layout.sheetBottom]
  );

  const snapRatio = expanded ? expandedSnapRatio : primarySnapRatio;
  const maxRatio = expanded ? expandedMaxRatio : contentSized ? contentMaxRatio : primarySnapRatio;
  const useContentSizing = contentSized && !expanded;

  if (Platform.OS === "web") {
    const maxPx = Math.max(Math.round(layout.overlayHeight * maxRatio), 280);
    const maxDvh = Math.round(maxRatio * 100);

    if (useContentSizing) {
      return {
        sheetMarginBottom: layout.sheetBottom,
        contentBottomPadding: spacing.sm,
        sheetSnapHeight: undefined,
        sheetMaxHeight: `min(${maxDvh}dvh, ${maxPx}px)`,
        snapRatio: 0.42,
        contentSized: true,
        webOverlayStyle,
        webSheetAnchorStyle,
      };
    }

    const snapPx = Math.max(Math.round(layout.overlayHeight * snapRatio), 280);
    const snapDvh = Math.round(snapRatio * 100);

    return {
      sheetMarginBottom: layout.sheetBottom,
      contentBottomPadding: spacing.lg,
      sheetSnapHeight: `min(${snapDvh}dvh, ${snapPx}px)`,
      sheetMaxHeight: `min(${maxDvh}dvh, ${maxPx}px)`,
      snapRatio,
      contentSized: false,
      webOverlayStyle,
      webSheetAnchorStyle,
    };
  }

  const nativeBottom =
    Math.max(insets.bottom, spacing.sm) +
    BOTTOM_SHEET_SAFETY_MARGIN_PX +
    BOTTOM_SHEET_EXTRA_LIFT_PX;

  if (useContentSizing) {
    return {
      sheetMarginBottom: nativeBottom,
      contentBottomPadding: spacing.sm,
      sheetSnapHeight: undefined,
      sheetMaxHeight: `${maxRatio * 100}%`,
      snapRatio: 0.42,
      contentSized: true,
      webOverlayStyle: null,
      webSheetAnchorStyle: null,
    };
  }

  return {
    sheetMarginBottom: nativeBottom,
    contentBottomPadding: spacing.lg,
    sheetSnapHeight: `${snapRatio * 100}%`,
    sheetMaxHeight: `${maxRatio * 100}%`,
    snapRatio,
    contentSized: false,
    webOverlayStyle: null,
    webSheetAnchorStyle: null,
  };
}
