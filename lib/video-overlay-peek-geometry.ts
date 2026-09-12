/** One-line overlay composer (68px row + 12px clearance). Peek math ignores growth past this. */
export const VIDEO_OVERLAY_SINGLE_LINE_COMPOSER_RESERVE_PX = 80;

export const VIDEO_OVERLAY_HEADER_CHROME_PX = 80;
export const VIDEO_OVERLAY_MIN_LIST_PX = 100;
export const VIDEO_PEEK_ABSOLUTE_MIN_PX = 112;
export const VIDEO_PEEK_MIN_LAYOUT_FRACTION = 0.25;

/** Keyboard-open preview floor — shrink the list before the peek drops below this. */
export const VIDEO_OVERLAY_KEYBOARD_PEEK_FLOOR_PX = 160;
/** @deprecated Kept for source checks; keyboard peek is no longer capped below the closed snap. */
export const VIDEO_OVERLAY_KEYBOARD_PEEK_MAX_PX = 400;
/** Handle wrap (24) + title/X row (36) + column paddingTop (6). Never below ~56. */
export const VIDEO_OVERLAY_KEYBOARD_HEADER_MIN_PX = 66;

/** Fraction of layout viewport used to seed the baseline preview before keyboard focus. */
export const COMMENTS_VIDEO_PEEK_FRACTION = 0.31;
/** Target preview band on large phones — preserved while typing when space allows. */
export const COMMENTS_VIDEO_PEEK_TARGET_MIN_PX = 330;
export const COMMENTS_VIDEO_PEEK_TARGET_MAX_PX = 400;

/** Baseline preview height from the full layout viewport — not keyboard-reduced visual height. */
export function computeBaselineVideoPeekHeight(layoutHeight: number): number {
  const fromFraction = Math.round(layoutHeight * COMMENTS_VIDEO_PEEK_FRACTION);
  const layoutTargetMin = Math.round(layoutHeight * 0.38);
  const targetMin = Math.min(
    COMMENTS_VIDEO_PEEK_TARGET_MAX_PX,
    Math.max(COMMENTS_VIDEO_PEEK_TARGET_MIN_PX, layoutTargetMin)
  );
  const targetMax = Math.min(
    COMMENTS_VIDEO_PEEK_TARGET_MAX_PX,
    Math.round(layoutHeight * 0.46)
  );
  return Math.min(targetMax, Math.max(fromFraction, targetMin));
}

export type VideoOverlayPeekBandInput = {
  layoutHeight: number;
  usableHeight: number;
  baselinePeekHeight: number;
  composerBottomReserve: number;
  /** When true, keep the closed peek if it fits; otherwise shrink the list first. */
  keyboardOpen?: boolean;
};

export type VideoOverlayVisibleGeometry = {
  visibleHeight: number;
  overlayTop: 0;
  overlayHeight: number;
  /** Sheet starts here inside the overlay — equal to the video peek. */
  sheetTop: number;
  /** Remaining visible space under the peek. Never the full visual height. */
  sheetHeight: number;
  peekHeight: number;
};

function resolvePeekHeight(input: VideoOverlayPeekBandInput, visibleHeight: number): number {
  const fullReserve = Math.max(0, input.composerBottomReserve);
  const peekReserve = Math.max(
    VIDEO_OVERLAY_SINGLE_LINE_COMPOSER_RESERVE_PX,
    Math.min(fullReserve, VIDEO_OVERLAY_SINGLE_LINE_COMPOSER_RESERVE_PX)
  );
  const minSheetChrome =
    VIDEO_OVERLAY_KEYBOARD_HEADER_MIN_PX + VIDEO_OVERLAY_MIN_LIST_PX + peekReserve;
  const maxPeek = Math.max(0, visibleHeight - minSheetChrome);
  if (maxPeek >= VIDEO_OVERLAY_KEYBOARD_PEEK_FLOOR_PX) {
    return Math.min(input.baselinePeekHeight, maxPeek);
  }
  return maxPeek;
}

/**
 * One coordinate model: overlay fills the visual viewport (top 0).
 * The sheet begins at `peekHeight` and its height is the remaining visible
 * space. Never `sheetTop = peek` and `sheetHeight = visualHeight` together.
 */
export function resolveVideoOverlayVisibleGeometry(
  input: VideoOverlayPeekBandInput
): VideoOverlayVisibleGeometry {
  const visibleHeight = Math.max(0, Math.round(input.usableHeight));
  const peekHeight = resolvePeekHeight(input, visibleHeight);
  const sheetHeight = Math.max(0, visibleHeight - peekHeight);
  return {
    visibleHeight,
    overlayTop: 0,
    overlayHeight: visibleHeight,
    sheetTop: peekHeight,
    sheetHeight,
    peekHeight,
  };
}

/** Peek + sheet height. `height` is the sheet, not the overlay. */
export function resolveVideoOverlayPeekAndSheetHeight(input: VideoOverlayPeekBandInput): {
  peekHeight: number;
  height: number;
} {
  const geometry = resolveVideoOverlayVisibleGeometry(input);
  return {
    peekHeight: geometry.peekHeight,
    height: geometry.sheetHeight,
  };
}
