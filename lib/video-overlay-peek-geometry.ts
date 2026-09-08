/** One-line overlay composer (68px row + 12px clearance). Peek math ignores growth past this. */
export const VIDEO_OVERLAY_SINGLE_LINE_COMPOSER_RESERVE_PX = 80;

export const VIDEO_OVERLAY_HEADER_CHROME_PX = 80;
export const VIDEO_OVERLAY_MIN_LIST_PX = 100;
export const VIDEO_PEEK_ABSOLUTE_MIN_PX = 112;
export const VIDEO_PEEK_MIN_LAYOUT_FRACTION = 0.25;

/** Keyboard-open preview floor — list/header yield before the peek drops below this. */
export const VIDEO_OVERLAY_KEYBOARD_PEEK_FLOOR_PX = 240;
export const VIDEO_OVERLAY_KEYBOARD_PEEK_MAX_PX = 280;
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
  /** When true, cap composer reserve at one line and keep a 240–280px peek. */
  keyboardOpen?: boolean;
};

function resolveKeyboardOpenPeekAndSheetHeight(input: VideoOverlayPeekBandInput): {
  peekHeight: number;
  height: number;
} {
  const { usableHeight, baselinePeekHeight, composerBottomReserve } = input;
  const fullReserve = Math.max(0, composerBottomReserve);
  const peekReserve = Math.min(fullReserve, VIDEO_OVERLAY_SINGLE_LINE_COMPOSER_RESERVE_PX);
  const available = Math.max(
    0,
    usableHeight - peekReserve - VIDEO_OVERLAY_KEYBOARD_HEADER_MIN_PX
  );
  const peekHeight = Math.min(
    baselinePeekHeight,
    VIDEO_OVERLAY_KEYBOARD_PEEK_MAX_PX,
    available < VIDEO_OVERLAY_KEYBOARD_PEEK_FLOOR_PX
      ? available
      : Math.max(
          VIDEO_OVERLAY_KEYBOARD_PEEK_FLOOR_PX,
          Math.min(available, VIDEO_OVERLAY_KEYBOARD_PEEK_MAX_PX)
        )
  );
  return {
    peekHeight,
    height: Math.max(
      VIDEO_OVERLAY_KEYBOARD_HEADER_MIN_PX,
      usableHeight - fullReserve - peekHeight
    ),
  };
}

/** Keep a useful video peek; shrink the comments list when the keyboard reduces space. */
export function resolveVideoOverlayPeekAndSheetHeight(input: VideoOverlayPeekBandInput): {
  peekHeight: number;
  height: number;
} {
  if (input.keyboardOpen) {
    return resolveKeyboardOpenPeekAndSheetHeight(input);
  }

  const { layoutHeight, usableHeight, baselinePeekHeight, composerBottomReserve } = input;
  const usefulMin = Math.min(
    baselinePeekHeight,
    Math.max(VIDEO_PEEK_ABSOLUTE_MIN_PX, Math.round(layoutHeight * VIDEO_PEEK_MIN_LAYOUT_FRACTION))
  );
  const spaceAfterReserve = Math.max(0, usableHeight - Math.max(0, composerBottomReserve));
  const minCommentsSheetHeight = VIDEO_OVERLAY_HEADER_CHROME_PX + VIDEO_OVERLAY_MIN_LIST_PX;
  const maxPeekKeepingList = spaceAfterReserve - minCommentsSheetHeight;

  let peekHeight: number;
  if (maxPeekKeepingList >= usefulMin) {
    peekHeight = Math.min(baselinePeekHeight, maxPeekKeepingList);
  } else {
    peekHeight = Math.min(
      usefulMin,
      Math.max(VIDEO_PEEK_ABSOLUTE_MIN_PX, spaceAfterReserve - VIDEO_OVERLAY_HEADER_CHROME_PX)
    );
  }

  return {
    peekHeight,
    height: Math.max(VIDEO_OVERLAY_HEADER_CHROME_PX, spaceAfterReserve - peekHeight),
  };
}
