import { isIosSafariBrowser, isWebStandalone } from "@/lib/pwa";
import {
  isVisualViewportKeyboardOpen,
  measureSafariVisualViewport,
  readEnvSafeAreaTop,
  type SafariVisualViewportSnapshot,
} from "@/lib/safari-visual-viewport";
import { VIDEO_OVERLAY_COMPOSER_CLEARANCE_PX } from "@/lib/use-video-overlay-portaled-composer-reserve";

/** Safari tab toolbar band above the keyboard — not present in standalone PWA. */
export const IOS_SAFARI_FLOATING_CONTROLS_PX = 90;

const KEYBOARD_OPEN_THRESHOLD_PX = 100;

export type VideoOverlayViewportFrame = {
  offsetTop: number;
  visualHeight: number;
  /** Visual viewport height minus Safari floating toolbar when applicable. */
  usableHeight: number;
  safariControlsClearance: number;
  safeAreaTop: number;
  keyboardOpen: boolean;
};

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
  const safariControlsClearance =
    isIosSafariBrowser() && !standalone && keyboardOpen
      ? IOS_SAFARI_FLOATING_CONTROLS_PX
      : 0;
  const safeAreaTop = standalone ? readEnvSafeAreaTop() : 0;
  const usableHeight = Math.max(180, snapshot.visualHeight - safariControlsClearance);

  return {
    offsetTop: snapshot.offsetTop,
    visualHeight: snapshot.visualHeight,
    usableHeight,
    safariControlsClearance,
    safeAreaTop,
    keyboardOpen,
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
