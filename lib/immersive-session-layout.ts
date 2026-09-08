/**
 * Layout-viewport height frozen for one immersive viewer / lightbox session.
 * Capture from the keyboard-closed layout height. Do not recapture on Comments X
 * or from a shrunken keyboard viewport. Clear only when the viewer session ends.
 */

let sessionLayoutHeight: number | null = null;

/** Record the first keyboard-closed layout height. Later shrunken samples are ignored. */
export function captureImmersiveSessionLayoutHeight(
  layoutHeight: number,
  keyboardOpen: boolean
): number | null {
  if (sessionLayoutHeight != null) {
    return sessionLayoutHeight;
  }
  if (keyboardOpen || layoutHeight <= 0) {
    return null;
  }
  sessionLayoutHeight = Math.round(layoutHeight);
  return sessionLayoutHeight;
}

export function getImmersiveSessionLayoutHeight(): number | null {
  return sessionLayoutHeight;
}

/** End of the immersive viewer / lightbox session — not Comments X. */
export function clearImmersiveSessionLayoutHeight(): void {
  sessionLayoutHeight = null;
}
