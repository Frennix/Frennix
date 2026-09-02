import { useEffect, useState } from "react";
import { Platform } from "react-native";
import {
  isMobileWebSafari,
  readSafariCommentsOverlayBottomReserve,
  subscribeSafariVisualViewport,
} from "@/lib/safari-visual-viewport";

/**
 * Safari chrome reserve subtracted from comments overlay height (not composerHost padding).
 * Shrinks the fixed root so the list flexes while the composer keeps its measured height.
 */
export function useCommentsOverlayBottomReserve(active: boolean): number {
  const [reserve, setReserve] = useState(() =>
    active ? readSafariCommentsOverlayBottomReserve() : 0
  );

  useEffect(() => {
    if (Platform.OS !== "web" || !active || !isMobileWebSafari()) {
      setReserve(0);
      return;
    }

    const sync = () => {
      setReserve(readSafariCommentsOverlayBottomReserve());
    };

    sync();
    requestAnimationFrame(sync);

    const onFocusChange = () => {
      sync();
      requestAnimationFrame(sync);
    };

    const unsubViewport = subscribeSafariVisualViewport(sync);
    document.addEventListener("focusin", onFocusChange);
    document.addEventListener("focusout", onFocusChange);

    return () => {
      unsubViewport();
      document.removeEventListener("focusin", onFocusChange);
      document.removeEventListener("focusout", onFocusChange);
    };
  }, [active]);

  return reserve;
}

/**
 * Safe-area padding for desktop/native sheet surfaces — not Safari overlay height reserve.
 */
export function useCommentComposerHostBottomInset(closedBottomInset: number, active: boolean): number {
  if (!active) {
    return closedBottomInset;
  }
  return closedBottomInset;
}
