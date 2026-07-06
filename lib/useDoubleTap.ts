import { useCallback, useRef } from "react";

const DEFAULT_WINDOW_MS = 280;

/** Detects double-tap / double-click within a short window. */
export function useDoubleTap(
  onDoubleTap: (() => void) | undefined,
  windowMs = DEFAULT_WINDOW_MS
) {
  const lastTapAt = useRef(0);

  return useCallback(() => {
    if (!onDoubleTap) return false;
    const now = Date.now();
    if (now - lastTapAt.current < windowMs) {
      lastTapAt.current = 0;
      onDoubleTap();
      return true;
    }
    lastTapAt.current = now;
    return false;
  }, [onDoubleTap, windowMs]);
}
