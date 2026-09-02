import { useEffect, useState } from "react";
import { Platform } from "react-native";
import {
  isMobileWebSafari,
  isVisualViewportKeyboardOpen,
  measureSafariVisualViewport,
  readSafariCommentComposerAccessoryLiftPx,
  subscribeSafariVisualViewport,
} from "@/lib/safari-visual-viewport";

function isCommentComposerTextareaFocused(): boolean {
  if (typeof document === "undefined") return false;
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return false;
  return active.matches('textarea[data-frennix-comment-input="true"]');
}

function readCommentComposerHostBottomInset(closedBottomInset: number): number {
  if (Platform.OS !== "web") return closedBottomInset;

  const snapshot = measureSafariVisualViewport();
  const keyboardOpen = isVisualViewportKeyboardOpen(snapshot);

  if (!keyboardOpen) {
    return closedBottomInset;
  }

  if (!isMobileWebSafari() || !isCommentComposerTextareaFocused()) {
    return 0;
  }

  return readSafariCommentComposerAccessoryLiftPx();
}

/**
 * Bottom padding for the comments composer host.
 * Keyboard closed: home-indicator safe area. Keyboard open on iOS Safari with focused
 * comment textarea: lift above the InputAccessoryView / form navigation bar.
 */
export function useCommentComposerHostBottomInset(closedBottomInset: number, active: boolean): number {
  const [bottomInset, setBottomInset] = useState(() =>
    active ? readCommentComposerHostBottomInset(closedBottomInset) : closedBottomInset
  );

  useEffect(() => {
    if (Platform.OS !== "web" || !active) {
      setBottomInset(closedBottomInset);
      return;
    }

    const sync = () => {
      setBottomInset(readCommentComposerHostBottomInset(closedBottomInset));
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
  }, [active, closedBottomInset]);

  return bottomInset;
}
