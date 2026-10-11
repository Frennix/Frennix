import { useEffect, useMemo, useState } from "react";
import { Platform, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "@frennix/ui";
import { resolveBottomSheetWebFrame } from "@/lib/bottom-sheet-web-frame";
import { OVERLAY_Z_INDEX } from "@/lib/overlay-z-index";
import {
  measureSafariVisualViewport,
  OVERLAY_BOTTOM_SAFETY_MARGIN_PX,
  subscribeSafariVisualViewport,
  isIOSWeb,
} from "@/lib/safari-visual-viewport";

/** @deprecated Import from `@/lib/safari-visual-viewport` */
export const BOTTOM_SHEET_SAFETY_MARGIN_PX = OVERLAY_BOTTOM_SAFETY_MARGIN_PX;

/** Legacy viewport snap — only used when contentSized is false. */
export const BOTTOM_SHEET_PRIMARY_SNAP_RATIO = 0.68;

/** Taller snap when expanded content is shown. */
export const BOTTOM_SHEET_EXPANDED_SNAP_RATIO = 0.72;

/** Max height when expanded content needs to scroll. */
export const BOTTOM_SHEET_EXPANDED_MAX_RATIO = 0.85;

/** Soft cap for content-sized sheets before scrolling kicks in. */
export const BOTTOM_SHEET_CONTENT_MAX_RATIO = 0.88;

export type BottomActionSheetLayoutOptions = {
  expanded?: boolean;
  /** Size sheet to its content instead of a fixed viewport snap. Default: true when not expanded. */
  contentSized?: boolean;
  primarySnapRatio?: number;
  expandedSnapRatio?: number;
  expandedMaxRatio?: number;
  contentMaxRatio?: number;
};

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
  const [viewport, setViewport] = useState(() =>
    Platform.OS === "web" ? measureSafariVisualViewport() : null
  );

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || !visible) return;

    const update = () => {
      const next = measureSafariVisualViewport();
      setViewport((prev) =>
        prev &&
        prev.offsetTop === next.offsetTop &&
        prev.overlayHeight === next.overlayHeight &&
        prev.sheetInset === next.sheetInset
          ? prev
          : next
      );
    };

    update();
    return subscribeSafariVisualViewport(update);
  }, [visible]);

  const pinToVisualViewport =
    Platform.OS === "web" &&
    visible &&
    isIOSWeb() &&
    typeof window !== "undefined" &&
    viewport != null;
  const snapRatio = expanded ? expandedSnapRatio : primarySnapRatio;
  const maxRatio = expanded ? expandedMaxRatio : contentSized ? contentMaxRatio : primarySnapRatio;
  const useContentSizing = contentSized && !expanded;

  const frame =
    viewport != null
      ? resolveBottomSheetWebFrame({
          snapshot: viewport,
          pinToVisualViewport,
          contentSized: useContentSizing,
          snapRatio: useContentSizing ? 0.42 : snapRatio,
          maxRatio,
        })
      : null;

  const webOverlayStyle = useMemo(
    () =>
      frame?.pinToVisualViewport
        ? ({
            position: "fixed",
            top: frame.overlayTop,
            left: 0,
            right: 0,
            width: "100%",
            height: frame.overlayHeight,
            minHeight: frame.overlayHeight,
            maxHeight: frame.overlayHeight,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            overflow: "hidden",
            zIndex: OVERLAY_Z_INDEX.actionSheet,
          } as ViewStyle)
        : null,
    [frame]
  );

  const webSheetAnchorStyle = useMemo(
    () =>
      frame?.pinToVisualViewport
        ? ({
            width: "100%",
            marginBottom: frame.marginBottom,
            maxHeight: frame.maxHeightPx,
            flexShrink: 1,
            minHeight: 0,
          } as ViewStyle)
        : null,
    [frame]
  );

  const overlayHeight = viewport?.overlayHeight ?? 0;
  const sheetInset = viewport?.sheetInset ?? spacing.lg;

  if (Platform.OS === "web" && frame?.pinToVisualViewport) {
    return {
      sheetMarginBottom: frame.marginBottom,
      contentBottomPadding: useContentSizing ? spacing.sm : spacing.lg,
      sheetSnapHeight: useContentSizing ? undefined : frame.snapHeightPx,
      sheetMaxHeight: frame.maxHeightPx,
      snapRatio: useContentSizing ? 0.42 : snapRatio,
      contentSized: useContentSizing,
      webOverlayStyle,
      webSheetAnchorStyle,
    };
  }

  if (Platform.OS === "web") {
    const maxPx = Math.max(Math.round(overlayHeight * maxRatio), 280);
    const maxDvh = Math.round(maxRatio * 100);

    if (useContentSizing) {
      return {
        sheetMarginBottom: sheetInset,
        contentBottomPadding: spacing.sm,
        sheetSnapHeight: undefined,
        sheetMaxHeight: `min(${maxDvh}dvh, ${maxPx}px)`,
        snapRatio: 0.42,
        contentSized: true,
        webOverlayStyle,
        webSheetAnchorStyle,
      };
    }

    const snapPx = Math.max(Math.round(overlayHeight * snapRatio), 280);
    const snapDvh = Math.round(snapRatio * 100);

    return {
      sheetMarginBottom: sheetInset,
      contentBottomPadding: spacing.lg,
      sheetSnapHeight: `min(${snapDvh}dvh, ${snapPx}px)`,
      sheetMaxHeight: `min(${maxDvh}dvh, ${maxPx}px)`,
      snapRatio,
      contentSized: false,
      webOverlayStyle,
      webSheetAnchorStyle,
    };
  }

  const nativeBottom = Math.max(insets.bottom, spacing.sm) + OVERLAY_BOTTOM_SAFETY_MARGIN_PX;

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
