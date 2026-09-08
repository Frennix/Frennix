import { isIosSafariBrowser, isWebStandalone } from "@/lib/pwa";
import {
  isVisualViewportKeyboardOpen,
  measureSafariVisualViewport,
  readEnvSafeAreaTop,
  type SafariVisualViewportSnapshot,
} from "@/lib/safari-visual-viewport";
import { VIDEO_OVERLAY_COMPOSER_CLEARANCE_PX } from "@/lib/use-video-overlay-portaled-composer-reserve";

export {
  resolveVideoOverlayPeekAndSheetHeight,
  VIDEO_OVERLAY_HEADER_CHROME_PX,
  VIDEO_OVERLAY_KEYBOARD_HEADER_MIN_PX,
  VIDEO_OVERLAY_KEYBOARD_PEEK_FLOOR_PX,
  VIDEO_OVERLAY_KEYBOARD_PEEK_MAX_PX,
  VIDEO_OVERLAY_MIN_LIST_PX,
  VIDEO_OVERLAY_SINGLE_LINE_COMPOSER_RESERVE_PX,
  VIDEO_PEEK_ABSOLUTE_MIN_PX,
  VIDEO_PEEK_MIN_LAYOUT_FRACTION,
  type VideoOverlayPeekBandInput,
} from "@/lib/video-overlay-peek-geometry";

/** Historical Safari toolbar estimate — never subtract when visualViewport already shrank. */
export const IOS_SAFARI_FLOATING_CONTROLS_PX = 90;

const KEYBOARD_OPEN_THRESHOLD_PX = 100;

export type VideoOverlayViewportFrame = {
  offsetTop: number;
  visualHeight: number;
  /** Visual viewport height minus any measured overlapping chrome. */
  usableHeight: number;
  safariControlsClearance: number;
  safeAreaTop: number;
  keyboardOpen: boolean;
  /** Layout viewport height (`window.innerHeight`) at sample time. */
  layoutHeight: number;
};

export type SafariControlsClearanceInput = {
  isIosSafari: boolean;
  standalone: boolean;
  keyboardOpen: boolean;
  bottomChrome: number;
  layoutHeight: number;
  visualHeight: number;
};

/**
 * Extra Safari-tab chrome to subtract from visualHeight.
 * Standalone PWA uses safe-area padding instead.
 * Safari browser: skip the 90px constant when visualViewport already excluded chrome/keyboard.
 */
export function resolveSafariControlsClearance(input: SafariControlsClearanceInput): number {
  if (input.standalone || !input.isIosSafari || !input.keyboardOpen) {
    return 0;
  }

  const alreadyAccountedInVisualViewport =
    input.bottomChrome > 0 || input.layoutHeight - input.visualHeight > 0;
  if (alreadyAccountedInVisualViewport) {
    return 0;
  }

  return 0;
}

function isVideoOverlayKeyboardOpen(snapshot: SafariVisualViewportSnapshot): boolean {
  return (
    isVisualViewportKeyboardOpen(snapshot) ||
    snapshot.layoutHeight - snapshot.visualHeight > KEYBOARD_OPEN_THRESHOLD_PX
  );
}

/** Mode-aware visual viewport frame for the immersive video comments overlay. */
export function measureVideoOverlayViewportFrame(): VideoOverlayViewportFrame {
  const snapshot = measureSafariVisualViewport();
  const standalone = isWebStandalone();
  const keyboardOpen = isVideoOverlayKeyboardOpen(snapshot);
  const safariControlsClearance = resolveSafariControlsClearance({
    isIosSafari: isIosSafariBrowser(),
    standalone,
    keyboardOpen,
    bottomChrome: snapshot.bottomChrome,
    layoutHeight: snapshot.layoutHeight,
    visualHeight: snapshot.visualHeight,
  });
  const safeAreaTop = standalone ? readEnvSafeAreaTop() : 0;
  const usableHeight = Math.max(180, snapshot.visualHeight - safariControlsClearance);

  return {
    offsetTop: snapshot.offsetTop,
    visualHeight: snapshot.visualHeight,
    usableHeight,
    safariControlsClearance,
    safeAreaTop,
    keyboardOpen,
    layoutHeight: snapshot.layoutHeight,
  };
}

/** Fixed `top` for the portaled composer — matches the overlay frame bottom. */
export function computeVideoOverlayComposerTop(
  composerHeight: number,
  frame: VideoOverlayViewportFrame = measureVideoOverlayViewportFrame()
): number {
  return Math.round(
    frame.offsetTop +
      frame.visualHeight -
      frame.safariControlsClearance -
      composerHeight -
      VIDEO_OVERLAY_COMPOSER_CLEARANCE_PX
  );
}

/** Fixed frame that contains the video peek + comments sheet above the keyboard. */
export function computeVideoOverlayFixedFrameStyle(frame: VideoOverlayViewportFrame): {
  top: number;
  height: number;
  paddingTop: number;
} {
  return {
    top: frame.offsetTop,
    height: frame.usableHeight,
    paddingTop: frame.safeAreaTop,
  };
}
