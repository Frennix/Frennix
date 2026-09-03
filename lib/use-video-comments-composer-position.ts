import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { subscribeSafariVisualViewport } from "@/lib/safari-visual-viewport";

export const VIDEO_COMPOSER_HOST_SELECTOR = '[data-video-comment-composer="true"]';
const SAFARI_KEYBOARD_CLEARANCE_PX = 90;
const SAFARI_TOOLBAR_CLEARANCE_PX = 72;
const KEYBOARD_OPEN_THRESHOLD_PX = 100;

function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function readVideoCommentKeyboardMetrics(): {
  keyboardHeight: number;
  keyboardOpen: boolean;
} {
  if (typeof window === "undefined" || !window.visualViewport) {
    return { keyboardHeight: 0, keyboardOpen: false };
  }

  const viewport = window.visualViewport;
  const keyboardHeight = Math.max(
    0,
    Math.round(window.innerHeight - viewport.height - viewport.offsetTop)
  );
  return {
    keyboardHeight,
    keyboardOpen: keyboardHeight > KEYBOARD_OPEN_THRESHOLD_PX,
  };
}

function applyVideoCommentComposerViewport(host: HTMLElement): void {
  const { keyboardHeight, keyboardOpen } = readVideoCommentKeyboardMetrics();
  const standalone = isStandalonePwa();

  host.dataset.videoComposerStandalone = standalone ? "true" : "false";
  host.dataset.videoComposerKeyboardOpen = keyboardOpen ? "true" : "false";

  if (keyboardOpen) {
    host.style.setProperty("--keyboard-offset", `${keyboardHeight}px`);
    host.style.setProperty("--safari-keyboard-clearance", `${SAFARI_KEYBOARD_CLEARANCE_PX}px`);
    host.style.setProperty("--safari-toolbar-clearance", "0px");
  } else {
    host.style.setProperty("--keyboard-offset", "0px");
    host.style.setProperty("--safari-keyboard-clearance", "0px");
    host.style.setProperty(
      "--safari-toolbar-clearance",
      standalone ? "0px" : `${SAFARI_TOOLBAR_CLEARANCE_PX}px`
    );
  }
}

function readVideoCommentComposerHeightPx(): number {
  if (typeof document === "undefined") return 0;
  const host = document.querySelector(VIDEO_COMPOSER_HOST_SELECTOR);
  if (!(host instanceof HTMLElement)) return 0;
  return Math.ceil(host.getBoundingClientRect().height);
}

/**
 * Anchors the video comment composer to visualViewport using CSS variables on
 * [data-video-comment-composer="true"] — not layout-gap / overlay-height reserve.
 */
export function useVideoCommentsComposerPosition(active: boolean): { composerHeight: number } {
  const [composerHeight, setComposerHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "web" || !active) {
      setComposerHeight(0);
      return;
    }

    const sync = () => {
      const host = document.querySelector(VIDEO_COMPOSER_HOST_SELECTOR);
      if (host instanceof HTMLElement) {
        applyVideoCommentComposerViewport(host);
      }
      setComposerHeight(readVideoCommentComposerHeightPx());
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

    const host = document.querySelector(VIDEO_COMPOSER_HOST_SELECTOR);
    let resizeObserver: ResizeObserver | undefined;
    if (host instanceof HTMLElement && typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(syncAfterSettle);
      resizeObserver.observe(host);
    }

    return () => {
      unsubViewport();
      window.visualViewport?.removeEventListener("scroll", syncAfterSettle);
      document.removeEventListener("focusin", syncAfterSettle);
      document.removeEventListener("focusout", syncAfterSettle);
      resizeObserver?.disconnect();
    };
  }, [active]);

  return { composerHeight };
}
