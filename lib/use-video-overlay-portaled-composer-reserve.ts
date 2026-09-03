import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { subscribeSafariVisualViewport } from "@/lib/safari-visual-viewport";

/** Matches VideoOverlayWebComposerPortal clearance — space between composer and keyboard. */
export const VIDEO_OVERLAY_COMPOSER_CLEARANCE_PX = 12;

export const VIDEO_OVERLAY_PORTALED_COMPOSER_SELECTOR = '[data-video-overlay-composer="true"]';

/** Measured portaled composer height plus keyboard clearance. */
export function readVideoOverlayPortaledComposerReserve(): number {
  if (typeof document === "undefined") return 0;
  const composer = document.querySelector(VIDEO_OVERLAY_PORTALED_COMPOSER_SELECTOR);
  if (!(composer instanceof HTMLElement)) return 0;
  return Math.ceil(composer.getBoundingClientRect().height) + VIDEO_OVERLAY_COMPOSER_CLEARANCE_PX;
}

/** Bottom reserve for the video overlay column while the portaled web composer is active. */
export function useVideoOverlayPortaledComposerReserve(active: boolean): number {
  const [reserve, setReserve] = useState(() =>
    active ? readVideoOverlayPortaledComposerReserve() : 0
  );

  useEffect(() => {
    if (Platform.OS !== "web" || !active) {
      setReserve(0);
      return;
    }

    const sync = () => {
      setReserve(readVideoOverlayPortaledComposerReserve());
    };

    const syncAfterSettle = () => {
      sync();
      requestAnimationFrame(() => {
        sync();
        requestAnimationFrame(sync);
      });
    };

    syncAfterSettle();

    const unsubViewport = subscribeSafariVisualViewport(syncAfterSettle);
    window.visualViewport?.addEventListener("scroll", syncAfterSettle);
    document.addEventListener("focusin", syncAfterSettle);
    document.addEventListener("focusout", syncAfterSettle);

    const composer = document.querySelector(VIDEO_OVERLAY_PORTALED_COMPOSER_SELECTOR);
    let resizeObserver: ResizeObserver | undefined;
    if (composer instanceof HTMLElement && typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(syncAfterSettle);
      resizeObserver.observe(composer);
    }

    return () => {
      unsubViewport();
      window.visualViewport?.removeEventListener("scroll", syncAfterSettle);
      document.removeEventListener("focusin", syncAfterSettle);
      document.removeEventListener("focusout", syncAfterSettle);
      resizeObserver?.disconnect();
    };
  }, [active]);

  return reserve;
}
