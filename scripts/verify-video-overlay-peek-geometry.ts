#!/usr/bin/env npx tsx
/**
 * Real geometry contract for immersive video comments peek allocation.
 * Imports the production helper — do not copy the formula here.
 */
import {
  resolveVideoOverlayPeekAndSheetHeight,
  VIDEO_OVERLAY_HEADER_CHROME_PX,
  VIDEO_OVERLAY_KEYBOARD_HEADER_MIN_PX,
  VIDEO_OVERLAY_KEYBOARD_PEEK_FLOOR_PX,
  VIDEO_OVERLAY_KEYBOARD_PEEK_MAX_PX,
  VIDEO_OVERLAY_MIN_LIST_PX,
} from "../lib/video-overlay-peek-geometry";

function pass(name: string, ok: boolean, detail = ""): boolean {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

function inKeyboardPeekBand(peekHeight: number): boolean {
  return (
    peekHeight >= VIDEO_OVERLAY_KEYBOARD_PEEK_FLOOR_PX &&
    peekHeight <= VIDEO_OVERLAY_KEYBOARD_PEEK_MAX_PX
  );
}

function main(): void {
  console.log("verify-video-overlay-peek-geometry\n");
  let ok = true;

  const closed = resolveVideoOverlayPeekAndSheetHeight({
    layoutHeight: 844,
    usableHeight: 670,
    baselinePeekHeight: 330,
    composerBottomReserve: 80,
  });
  const closedExplicit = resolveVideoOverlayPeekAndSheetHeight({
    layoutHeight: 844,
    usableHeight: 670,
    baselinePeekHeight: 330,
    composerBottomReserve: 80,
    keyboardOpen: false,
  });
  ok =
    pass(
      "Keyboard-closed peek stays 330",
      closed.peekHeight === 330 &&
        closedExplicit.peekHeight === 330 &&
        closed.height >= VIDEO_OVERLAY_HEADER_CHROME_PX + VIDEO_OVERLAY_MIN_LIST_PX &&
        closedExplicit.height === closed.height,
      `peek=${closed.peekHeight} height=${closed.height}`
    ) && ok;

  const keyboardOneLine = resolveVideoOverlayPeekAndSheetHeight({
    layoutHeight: 844,
    usableHeight: 400,
    baselinePeekHeight: 330,
    composerBottomReserve: 80,
    keyboardOpen: true,
  });
  ok =
    pass(
      "Keyboard-open one-line peek stays in 240–280",
      inKeyboardPeekBand(keyboardOneLine.peekHeight) &&
        keyboardOneLine.height >= VIDEO_OVERLAY_KEYBOARD_HEADER_MIN_PX &&
        keyboardOneLine.height >= 56,
      `peek=${keyboardOneLine.peekHeight} height=${keyboardOneLine.height}`
    ) && ok;

  const keyboardCompact = resolveVideoOverlayPeekAndSheetHeight({
    layoutHeight: 844,
    usableHeight: 386,
    baselinePeekHeight: 330,
    composerBottomReserve: 80,
    keyboardOpen: true,
  });
  ok =
    pass(
      "Keyboard-open compact viewport still hits the 240 floor",
      keyboardCompact.peekHeight === VIDEO_OVERLAY_KEYBOARD_PEEK_FLOOR_PX &&
        keyboardCompact.height >= VIDEO_OVERLAY_KEYBOARD_HEADER_MIN_PX,
      `peek=${keyboardCompact.peekHeight} height=${keyboardCompact.height}`
    ) && ok;

  const reserve90 = resolveVideoOverlayPeekAndSheetHeight({
    layoutHeight: 844,
    usableHeight: 400,
    baselinePeekHeight: 330,
    composerBottomReserve: 90,
    keyboardOpen: true,
  });
  const reserve160 = resolveVideoOverlayPeekAndSheetHeight({
    layoutHeight: 844,
    usableHeight: 400,
    baselinePeekHeight: 330,
    composerBottomReserve: 160,
    keyboardOpen: true,
  });
  ok =
    pass(
      "Composer growth 90→160 at usable 400 keeps peek unchanged",
      reserve90.peekHeight === reserve160.peekHeight &&
        inKeyboardPeekBand(reserve90.peekHeight) &&
        reserve90.height >= 56 &&
        reserve160.height >= 56,
      `peek=${reserve90.peekHeight} sheet=${reserve90.height}→${reserve160.height}`
    ) && ok;
  ok =
    pass(
      "Composer growth 90→160 at usable 400 shrinks the sheet, not the peek",
      reserve160.height <= reserve90.height,
      `sheet=${reserve90.height}→${reserve160.height}`
    ) && ok;

  const roomyOneLine = resolveVideoOverlayPeekAndSheetHeight({
    layoutHeight: 844,
    usableHeight: 500,
    baselinePeekHeight: 330,
    composerBottomReserve: 90,
    keyboardOpen: true,
  });
  const roomyMultiline = resolveVideoOverlayPeekAndSheetHeight({
    layoutHeight: 844,
    usableHeight: 500,
    baselinePeekHeight: 330,
    composerBottomReserve: 160,
    keyboardOpen: true,
  });
  ok =
    pass(
      "Roomy keyboard-open multiline shrinks sheet while peek stays in band",
      roomyOneLine.peekHeight === roomyMultiline.peekHeight &&
        inKeyboardPeekBand(roomyOneLine.peekHeight) &&
        roomyMultiline.height < roomyOneLine.height,
      `peek=${roomyOneLine.peekHeight} sheet=${roomyOneLine.height}→${roomyMultiline.height}`
    ) && ok;

  const tightKeyboard = resolveVideoOverlayPeekAndSheetHeight({
    layoutHeight: 844,
    usableHeight: 330,
    baselinePeekHeight: 330,
    composerBottomReserve: 80,
    keyboardOpen: true,
  });
  ok =
    pass(
      "Physically tight keyboard viewport yields available peek, not the old 112 floor",
      tightKeyboard.peekHeight > 112 &&
        tightKeyboard.peekHeight === 330 - 80 - VIDEO_OVERLAY_KEYBOARD_HEADER_MIN_PX &&
        tightKeyboard.height >= VIDEO_OVERLAY_KEYBOARD_HEADER_MIN_PX,
      `peek=${tightKeyboard.peekHeight} height=${tightKeyboard.height}`
    ) && ok;

  console.log("");
  console.log(ok ? "All checks passed." : "Some checks failed.");
  process.exit(ok ? 0 : 1);
}

main();
