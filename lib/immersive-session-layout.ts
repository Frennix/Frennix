import { computeBaselineVideoPeekHeight } from "@/lib/video-overlay-peek-geometry";

/**
 * Layout-viewport height frozen for one immersive viewer / lightbox session.
 * Capture from the keyboard-closed layout height. Do not recapture on Comments X
 * or from a shrunken keyboard / Safari-toolbar viewport. Clear only when the
 * full video viewer session ends.
 */

/** Reject keyboard-shrunk innerHeight samples that iOS can report as "closed". */
export const MIN_IMMERSIVE_SESSION_LAYOUT_HEIGHT_PX = 560;

let sessionLayoutHeight: number | null = null;

/** Record the first keyboard-closed layout height. Later shrunken samples are ignored. */
export function captureImmersiveSessionLayoutHeight(
  layoutHeight: number,
  keyboardOpen: boolean
): number | null {
  if (sessionLayoutHeight != null) {
    return sessionLayoutHeight;
  }
  if (keyboardOpen || layoutHeight < MIN_IMMERSIVE_SESSION_LAYOUT_HEIGHT_PX) {
    return null;
  }
  sessionLayoutHeight = Math.round(layoutHeight);
  return sessionLayoutHeight;
}

export function getImmersiveSessionLayoutHeight(): number | null {
  return sessionLayoutHeight;
}

/** Frozen closed-keyboard video peek for this viewer session. */
export function getImmersiveSessionPeekHeight(): number | null {
  return sessionLayoutHeight == null ? null : computeBaselineVideoPeekHeight(sessionLayoutHeight);
}

/** End of the immersive viewer / lightbox session — not Comments X. */
export function clearImmersiveSessionLayoutHeight(): void {
  sessionLayoutHeight = null;
}
