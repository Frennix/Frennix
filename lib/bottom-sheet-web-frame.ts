import {
  OVERLAY_BOTTOM_SAFETY_MARGIN_PX,
  type SafariVisualViewportSnapshot,
} from "@/lib/safari-visual-viewport";

export type BottomSheetWebFrameInput = {
  snapshot: SafariVisualViewportSnapshot;
  /** iOS web pins the shell to the visual viewport, which already ends above the keyboard. */
  pinToVisualViewport: boolean;
  contentSized: boolean;
  snapRatio: number;
  maxRatio: number;
};

export type BottomSheetWebFrame = {
  pinToVisualViewport: boolean;
  overlayTop: number;
  overlayHeight: number;
  /**
   * Space inside the visible viewport for the home indicator.
   * Keyboard and browser chrome are already outside the visual viewport.
   */
  marginBottom: number;
  maxHeightPx: number;
  snapHeightPx: number;
};

/**
 * Frame for a bottom sheet on web.
 * When pinned, the keyboard height must not be added again as margin or min-height.
 */
export function resolveBottomSheetWebFrame(input: BottomSheetWebFrameInput): BottomSheetWebFrame {
  const { snapshot, pinToVisualViewport, snapRatio, maxRatio } = input;
  const overlayHeight = Math.max(snapshot.overlayHeight || snapshot.layoutHeight, 1);

  if (!pinToVisualViewport) {
    const marginBottom = snapshot.sheetInset;
    const maxHeightPx = Math.max(Math.round(overlayHeight * maxRatio), 1);
    const snapHeightPx = Math.min(Math.max(Math.round(overlayHeight * snapRatio), 1), maxHeightPx);
    return {
      pinToVisualViewport: false,
      overlayTop: 0,
      overlayHeight,
      marginBottom,
      maxHeightPx,
      snapHeightPx,
    };
  }

  const marginBottom = snapshot.envSafeAreaBottom + OVERLAY_BOTTOM_SAFETY_MARGIN_PX;
  const maxHeightPx = Math.max(overlayHeight - marginBottom, 1);
  const snapHeightPx = Math.min(Math.max(Math.round(overlayHeight * snapRatio), 1), maxHeightPx);

  return {
    pinToVisualViewport: true,
    overlayTop: snapshot.offsetTop,
    overlayHeight,
    marginBottom,
    maxHeightPx,
    snapHeightPx,
  };
}
