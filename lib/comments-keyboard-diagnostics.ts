import { Platform } from "react-native";
import { isFeedScrollDebugEnabled } from "@/lib/feed-scroll-debug";

const LOG_PREFIX = "[comments-keyboard-diag]";
const GEOMETRY_TOLERANCE_PX = 2;

export type CommentsKeyboardLayoutDiagnostics = {
  phase: string;
  innerHeight: number;
  visualHeight: number;
  offsetTop: number;
  bottomChrome: number;
  keyboardInset: number;
  overlayTop: number;
  overlayHeight: number;
  overlayBottom: number;
  sheetTop: number | null;
  sheetBottom: number | null;
  headerTop: number | null;
  headerBottom: number | null;
  composerTop: number | null;
  composerBottom: number | null;
  gapComposerToOverlayBottom: number | null;
  gapSheetToOverlayBottom: number | null;
  sheetTransform: string | null;
  overlayTransform: string | null;
  feedInComposerGap: boolean;
  failures: string[];
};

function readRect(selector: string): DOMRect | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector(selector);
  if (!(el instanceof HTMLElement)) return null;
  return el.getBoundingClientRect();
}

function readTransform(selector: string): string | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector(selector);
  if (!(el instanceof HTMLElement)) return null;
  return getComputedStyle(el).transform;
}

function feedOccupiesComposerGap(composerBottom: number, overlayBottom: number): boolean {
  if (typeof document === "undefined") return false;
  const gapStart = Math.min(composerBottom, overlayBottom);
  const gapEnd = Math.max(composerBottom, overlayBottom);
  if (gapEnd - gapStart < 3) return false;

  const sampleYs = [gapStart + 2, gapStart + (gapEnd - gapStart) / 2, gapEnd - 2];
  for (const y of sampleYs) {
    const hit = document.elementFromPoint(window.innerWidth / 2, y);
    if (!(hit instanceof Element)) continue;
    if (hit.closest('[data-frennix-comments-sheet="true"]')) continue;
    if (hit.closest("#feed-scroll-list, #feed-root-container, #feed-tab-scene")) return true;
  }
  return false;
}

/** Collect overlay/sheet/composer DOM rectangles for dev assertions. */
export function collectCommentsKeyboardLayoutDiagnostics(phase: string): CommentsKeyboardLayoutDiagnostics {
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  const offsetTop = Math.round(vv?.offsetTop ?? 0);
  const visualHeight = Math.round(vv?.height ?? (typeof window !== "undefined" ? window.innerHeight : 0));
  const overlayBottom = offsetTop + visualHeight;
  const layoutHeight = typeof window !== "undefined" ? window.innerHeight : 0;
  const bottomChrome = Math.max(0, Math.round(layoutHeight - offsetTop - visualHeight));

  const overlayRect = readRect('[data-frennix-comments-sheet="true"]');
  const sheetRect = readRect('[data-frennix-comments-sheet-panel="true"]');
  const headerRect = readRect('[data-frennix-comments-header="true"]');
  const composerRect = readRect('[data-frennix-comment-composer="true"]');

  const composerBottom = composerRect ? Math.round(composerRect.bottom) : null;
  const sheetBottom = sheetRect ? Math.round(sheetRect.bottom) : null;
  const headerTop = headerRect ? Math.round(headerRect.top) : null;

  const failures: string[] = [];
  if (composerBottom != null && Math.abs(composerBottom - overlayBottom) > GEOMETRY_TOLERANCE_PX) {
    failures.push(
      `composerBottom (${composerBottom}) != overlayBottom (${overlayBottom}) by ${Math.abs(composerBottom - overlayBottom)}px`
    );
  }
  if (sheetBottom != null && Math.abs(sheetBottom - overlayBottom) > GEOMETRY_TOLERANCE_PX) {
    failures.push(
      `sheetBottom (${sheetBottom}) != overlayBottom (${overlayBottom}) by ${Math.abs(sheetBottom - overlayBottom)}px`
    );
  }
  if (headerTop != null && (headerTop < offsetTop - GEOMETRY_TOLERANCE_PX || headerTop > overlayBottom)) {
    failures.push(`headerTop (${headerTop}) outside overlay [${offsetTop}, ${overlayBottom}]`);
  }

  const sheetTransform = readTransform('[data-frennix-comments-sheet-panel="true"]');
  if (sheetTransform && sheetTransform !== "none") {
    failures.push(`sheet has transform ${sheetTransform} (creates fixed containing block on iOS)`);
  }

  const feedInComposerGap =
    composerBottom != null ? feedOccupiesComposerGap(composerBottom, overlayBottom) : false;
  if (feedInComposerGap) {
    failures.push("feed element detected between composerBottom and overlayBottom");
  }

  return {
    phase,
    innerHeight: layoutHeight,
    visualHeight,
    offsetTop,
    bottomChrome,
    keyboardInset: bottomChrome,
    overlayTop: overlayRect ? Math.round(overlayRect.top) : offsetTop,
    overlayHeight: overlayRect ? Math.round(overlayRect.height) : visualHeight,
    overlayBottom: overlayRect ? Math.round(overlayRect.bottom) : overlayBottom,
    sheetTop: sheetRect ? Math.round(sheetRect.top) : null,
    sheetBottom,
    headerTop,
    headerBottom: headerRect ? Math.round(headerRect.bottom) : null,
    composerTop: composerRect ? Math.round(composerRect.top) : null,
    composerBottom,
    gapComposerToOverlayBottom:
      composerBottom != null ? Math.round(overlayBottom - composerBottom) : null,
    gapSheetToOverlayBottom: sheetBottom != null ? Math.round(overlayBottom - sheetBottom) : null,
    sheetTransform,
    overlayTransform: readTransform('[data-frennix-comments-sheet="true"]'),
    feedInComposerGap,
    failures,
  };
}

/** Runtime dev assertion — logs DOM rects and failure reasons when geometry drifts. */
export function assertCommentsModalGeometry(phase: string): boolean {
  if (Platform.OS !== "web" || typeof document === "undefined") return true;
  if (!document.querySelector('[data-frennix-comments-sheet="true"]')) return true;

  const diag = collectCommentsKeyboardLayoutDiagnostics(phase);
  if (!isFeedScrollDebugEnabled()) return diag.failures.length === 0;

  if (diag.failures.length > 0) {
    console.error(`${LOG_PREFIX} GEOMETRY ASSERTION FAILED (${phase})`, diag);
  } else {
    console.info(`${LOG_PREFIX} geometry ok (${phase})`, diag);
  }
  return diag.failures.length === 0;
}

export function logCommentsKeyboardLayout(phase: string): void {
  assertCommentsModalGeometry(phase);
}

if (typeof window !== "undefined") {
  (
    window as Window & {
      __FRENNIX_COMMENTS_KEYBOARD_DIAG__?: () => CommentsKeyboardLayoutDiagnostics;
    }
  ).__FRENNIX_COMMENTS_KEYBOARD_DIAG__ = () => collectCommentsKeyboardLayoutDiagnostics("manual");
}
