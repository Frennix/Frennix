import { Platform } from "react-native";
import { isFeedScrollDebugEnabled } from "@/lib/feed-scroll-debug";
import { measureSafariVisualViewport } from "@/lib/safari-visual-viewport";

const LOG_PREFIX = "[comments-keyboard-diag]";

export type CommentsKeyboardLayoutDiagnostics = {
  phase: string;
  innerHeight: number;
  visualHeight: number;
  offsetTop: number;
  bottomChrome: number;
  keyboardInset: number;
  composerSafeBottom: number;
  overlayTop: number;
  overlayHeight: number;
  overlayBottom: number;
  sheetTop: number | null;
  sheetBottom: number | null;
  composerTop: number | null;
  composerBottom: number | null;
  gapComposerToOverlayBottom: number | null;
};

function readRect(selector: string): { top: number; bottom: number } | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector(selector);
  if (!(el instanceof HTMLElement)) return null;
  const rect = el.getBoundingClientRect();
  return { top: Math.round(rect.top), bottom: Math.round(rect.bottom) };
}

/** Dev probe for Safari comments keyboard double-offset regressions. */
export function collectCommentsKeyboardLayoutDiagnostics(
  phase: string,
  composerSafeBottom: number
): CommentsKeyboardLayoutDiagnostics {
  const viewport = measureSafariVisualViewport();
  const overlayRect = readRect('[data-frennix-comments-sheet="true"]');
  const sheetRect = readRect('[data-frennix-comments-sheet-panel="true"]');
  const composerRect = readRect('[data-frennix-comment-composer="true"]');
  const overlayTop = viewport.offsetTop;
  const overlayHeight = viewport.visualHeight;
  const overlayBottom = overlayTop + overlayHeight;

  return {
    phase,
    innerHeight: viewport.layoutHeight,
    visualHeight: viewport.visualHeight,
    offsetTop: viewport.offsetTop,
    bottomChrome: viewport.bottomChrome,
    keyboardInset: viewport.bottomChrome,
    composerSafeBottom,
    overlayTop,
    overlayHeight,
    overlayBottom,
    sheetTop: sheetRect?.top ?? null,
    sheetBottom: sheetRect?.bottom ?? null,
    composerTop: composerRect?.top ?? null,
    composerBottom: composerRect?.bottom ?? null,
    gapComposerToOverlayBottom:
      composerRect != null ? Math.round(overlayBottom - composerRect.bottom) : null,
  };
}

export function logCommentsKeyboardLayout(phase: string, composerSafeBottom: number): void {
  if (Platform.OS !== "web" || !isFeedScrollDebugEnabled()) return;
  const diag = collectCommentsKeyboardLayoutDiagnostics(phase, composerSafeBottom);
  console.info(LOG_PREFIX, diag);
}

if (typeof window !== "undefined") {
  (
    window as Window & {
      __FRENNIX_COMMENTS_KEYBOARD_DIAG__?: () => CommentsKeyboardLayoutDiagnostics;
    }
  ).__FRENNIX_COMMENTS_KEYBOARD_DIAG__ = () => collectCommentsKeyboardLayoutDiagnostics("manual", 0);
}
