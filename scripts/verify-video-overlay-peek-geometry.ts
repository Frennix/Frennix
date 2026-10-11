#!/usr/bin/env npx tsx
/**
 * Real geometry contract for immersive video comments peek allocation.
 * Imports the production helper — do not copy the formula here.
 */
import {
  computeBaselineVideoPeekHeight,
  resolveVideoOverlayPeekAndSheetHeight,
  resolveVideoOverlayVisibleGeometry,
  VIDEO_OVERLAY_HEADER_CHROME_PX,
  VIDEO_OVERLAY_KEYBOARD_HEADER_MIN_PX,
  VIDEO_OVERLAY_KEYBOARD_PEEK_FLOOR_PX,
  VIDEO_OVERLAY_MIN_LIST_PX,
  VIDEO_OVERLAY_SINGLE_LINE_COMPOSER_RESERVE_PX,
} from "../lib/video-overlay-peek-geometry";
import {
  captureImmersiveSessionLayoutHeight,
  clearImmersiveSessionLayoutHeight,
  getImmersiveSessionLayoutHeight,
  getImmersiveSessionPeekHeight,
} from "../lib/immersive-session-layout";
function pass(name: string, ok: boolean, detail = ""): boolean {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
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
  const closedToolbar = resolveVideoOverlayPeekAndSheetHeight({
    layoutHeight: 844,
    usableHeight: 760,
    baselinePeekHeight: 330,
    composerBottomReserve: 80,
    keyboardOpen: false,
  });
  ok =
    pass(
      "Closed-keyboard peek stays 330; sheet uses visual height not 100dvh",
      closed.peekHeight === 330 &&
        closed.height === 340 &&
        closedToolbar.peekHeight === 330 &&
        closedToolbar.height === 430 &&
        closed.height >= VIDEO_OVERLAY_HEADER_CHROME_PX + VIDEO_OVERLAY_MIN_LIST_PX,
      `peek=${closed.peekHeight} height=${closed.height}`
    ) && ok;

  const keyboardOneLine = resolveVideoOverlayPeekAndSheetHeight({
    layoutHeight: 844,
    usableHeight: 400,
    baselinePeekHeight: 330,
    composerBottomReserve: 80,
    keyboardOpen: true,
  });
  const expectedKeyboardPeek =
    400 -
    VIDEO_OVERLAY_KEYBOARD_HEADER_MIN_PX -
    VIDEO_OVERLAY_MIN_LIST_PX -
    VIDEO_OVERLAY_SINGLE_LINE_COMPOSER_RESERVE_PX;
  ok =
    pass(
      "Keyboard-open shrinks peek only enough to keep header + list + composer",
      keyboardOneLine.peekHeight === expectedKeyboardPeek &&
        keyboardOneLine.peekHeight > 0 &&
        keyboardOneLine.height >= VIDEO_OVERLAY_KEYBOARD_HEADER_MIN_PX,
      `peek=${keyboardOneLine.peekHeight} height=${keyboardOneLine.height}`
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
        reserve90.peekHeight === keyboardOneLine.peekHeight &&
        reserve90.height === reserve160.height,
      `peek=${reserve90.peekHeight} sheet=${reserve90.height}→${reserve160.height}`
    ) && ok;

  const roomyOneLine = resolveVideoOverlayPeekAndSheetHeight({
    layoutHeight: 844,
    usableHeight: 600,
    baselinePeekHeight: 330,
    composerBottomReserve: 90,
    keyboardOpen: true,
  });
  const roomyMultiline = resolveVideoOverlayPeekAndSheetHeight({
    layoutHeight: 844,
    usableHeight: 600,
    baselinePeekHeight: 330,
    composerBottomReserve: 160,
    keyboardOpen: true,
  });
  ok =
    pass(
      "Roomy keyboard-open viewport keeps the closed peek",
      roomyOneLine.peekHeight === 330 &&
        roomyMultiline.peekHeight === 330 &&
        roomyOneLine.height === 270 &&
        roomyMultiline.height === 270,
      `peek=${roomyOneLine.peekHeight} sheet=${roomyOneLine.height}`
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
      "Tight keyboard viewport keeps a visible peek above the old 0-height collapse",
      tightKeyboard.peekHeight > 0 &&
        tightKeyboard.peekHeight < VIDEO_OVERLAY_KEYBOARD_PEEK_FLOOR_PX &&
        tightKeyboard.height >= VIDEO_OVERLAY_KEYBOARD_HEADER_MIN_PX,
      `peek=${tightKeyboard.peekHeight} height=${tightKeyboard.height}`
    ) && ok;

  ok = runLifecycleContract() && ok;
  ok = runVisibleGeometryContract() && ok;

  console.log("");
  console.log(ok ? "All checks passed." : "Some checks failed.");
  process.exit(ok ? 0 : 1);
}

function geometryFitsVisible(
  visibleHeight: number,
  composerReserve: number,
  options?: { layoutHeight?: number; baselinePeekHeight?: number; keyboardOpen?: boolean }
) {
  const layoutHeight = options?.layoutHeight ?? 844;
  const baselinePeekHeight = options?.baselinePeekHeight ?? computeBaselineVideoPeekHeight(layoutHeight);
  return resolveVideoOverlayVisibleGeometry({
    layoutHeight,
    usableHeight: visibleHeight,
    baselinePeekHeight,
    composerBottomReserve: composerReserve,
    keyboardOpen: options?.keyboardOpen,
  });
}

function runVisibleGeometryContract(): boolean {
  console.log("\nvisible geometry\n");
  let ok = true;
  const cases = [
    { name: "keyboard-closed portrait", visible: 760, reserve: 80, keyboardOpen: false },
    { name: "Safari toolbar expanded", visible: 670, reserve: 80, keyboardOpen: false },
    { name: "keyboard-open portrait", visible: 400, reserve: 80, keyboardOpen: true },
    { name: "very small visible viewport", visible: 320, reserve: 80, keyboardOpen: true },
    { name: "landscape", visible: 390, reserve: 80, keyboardOpen: false, layoutHeight: 390 },
  ];

  for (const testCase of cases) {
    const geometry = geometryFitsVisible(testCase.visible, testCase.reserve, {
      keyboardOpen: testCase.keyboardOpen,
      layoutHeight: testCase.layoutHeight,
    });
    const composerBottom = geometry.sheetTop + geometry.sheetHeight;
    ok =
      pass(
        `${testCase.name}: sheetTop + sheetHeight === visibleHeight`,
        geometry.sheetTop + geometry.sheetHeight === geometry.visibleHeight &&
          geometry.overlayTop === 0 &&
          geometry.overlayHeight === testCase.visible &&
          geometry.sheetHeight !== testCase.visible &&
          composerBottom === testCase.visible &&
          composerBottom <= testCase.visible,
        `sheetTop=${geometry.sheetTop} sheet=${geometry.sheetHeight} visible=${geometry.visibleHeight}`
      ) && ok;
  }

  const wrongModel = geometryFitsVisible(844, 80, { keyboardOpen: false });
  ok =
    pass(
      "Never uses sheetTop=peek and sheetHeight=full visual height together",
      wrongModel.sheetTop === wrongModel.peekHeight &&
        wrongModel.sheetHeight === 844 - wrongModel.peekHeight &&
        wrongModel.sheetHeight !== 844,
      `sheetTop=${wrongModel.sheetTop} sheetHeight=${wrongModel.sheetHeight}`
    ) && ok;

  const keyboardPeeks: number[] = [];
  const closedPeeks: number[] = [];
  for (let i = 0; i < 5; i += 1) {
    const opened = geometryFitsVisible(400, 80, { keyboardOpen: true });
    const closed = geometryFitsVisible(760, 80, { keyboardOpen: false });
    keyboardPeeks.push(opened.peekHeight);
    closedPeeks.push(closed.peekHeight);
  }
  ok =
    pass(
      "Five keyboard open/close cycles do not progressively shrink",
      keyboardPeeks.every((peek) => peek === keyboardPeeks[0]) &&
        closedPeeks.every((peek) => peek === 330),
      `keyboard=${keyboardPeeks.join(",")} closed=${closedPeeks.join(",")}`
    ) && ok;

  return ok;
}

function resolveWithSession(input: {
  layoutHeight: number;
  usableHeight: number;
  composerBottomReserve: number;
  keyboardOpen: boolean;
}) {
  captureImmersiveSessionLayoutHeight(input.layoutHeight, input.keyboardOpen);
  const frozenLayout = getImmersiveSessionLayoutHeight() ?? input.layoutHeight;
  const baselinePeek =
    getImmersiveSessionPeekHeight() ?? computeBaselineVideoPeekHeight(frozenLayout);
  return {
    sessionLayoutHeight: frozenLayout,
    ...resolveVideoOverlayPeekAndSheetHeight({
      layoutHeight: frozenLayout,
      usableHeight: input.usableHeight,
      baselinePeekHeight: baselinePeek,
      composerBottomReserve: input.composerBottomReserve,
      keyboardOpen: input.keyboardOpen,
    }),
  };
}

function runLifecycleContract(): boolean {
  console.log("\nlifecycle\n");
  let ok = true;
  clearImmersiveSessionLayoutHeight();

  const firstClosed = resolveWithSession({
    layoutHeight: 844,
    usableHeight: 760,
    composerBottomReserve: 80,
    keyboardOpen: false,
  });
  ok =
    pass(
      "First Comments opening with keyboard closed captures 844 and peek 330",
      getImmersiveSessionLayoutHeight() === 844 &&
        getImmersiveSessionPeekHeight() === 330 &&
        firstClosed.peekHeight === 330 &&
        firstClosed.height === 430,
      `session=${getImmersiveSessionLayoutHeight()} peek=${firstClosed.peekHeight}`
    ) && ok;

  const afterComposerMeasured = resolveWithSession({
    layoutHeight: 400,
    usableHeight: 400,
    composerBottomReserve: 80,
    keyboardOpen: true,
  });
  ok =
    pass(
      "Keyboard opening after composer measured keeps session 844 and a visible peek",
      getImmersiveSessionLayoutHeight() === 844 &&
        afterComposerMeasured.sessionLayoutHeight === 844 &&
        afterComposerMeasured.peekHeight ===
          400 -
            VIDEO_OVERLAY_KEYBOARD_HEADER_MIN_PX -
            VIDEO_OVERLAY_MIN_LIST_PX -
            VIDEO_OVERLAY_SINGLE_LINE_COMPOSER_RESERVE_PX &&
        afterComposerMeasured.peekHeight > 0,
      `session=${getImmersiveSessionLayoutHeight()} peek=${afterComposerMeasured.peekHeight}`
    ) && ok;

  const closingWhileKeyboardTransitioning = resolveWithSession({
    layoutHeight: 360,
    usableHeight: 380,
    composerBottomReserve: 80,
    keyboardOpen: true,
  });
  const recapturedBaseline = computeBaselineVideoPeekHeight(360);
  ok =
    pass(
      "Closing Comments while keyboard is transitioning does not recapture baseline",
      getImmersiveSessionLayoutHeight() === 844 &&
        recapturedBaseline < 240 &&
        closingWhileKeyboardTransitioning.peekHeight !== recapturedBaseline &&
        closingWhileKeyboardTransitioning.peekHeight ===
          380 -
            VIDEO_OVERLAY_KEYBOARD_HEADER_MIN_PX -
            VIDEO_OVERLAY_MIN_LIST_PX -
            VIDEO_OVERLAY_SINGLE_LINE_COMPOSER_RESERVE_PX,
      `session=${getImmersiveSessionLayoutHeight()} peek=${closingWhileKeyboardTransitioning.peekHeight} recapturedBaseline=${recapturedBaseline}`
    ) && ok;

  const closedReopenPeeks: number[] = [];
  const closedReopenSheets: number[] = [];
  for (let i = 0; i < 5; i += 1) {
    const reopened = resolveWithSession({
      layoutHeight: 700 - i * 40,
      usableHeight: 760,
      composerBottomReserve: 80 + i * 10,
      keyboardOpen: false,
    });
    closedReopenPeeks.push(reopened.peekHeight);
    closedReopenSheets.push(reopened.height);
    ok =
      pass(
        `Closed-keyboard reopen ${i + 1}/5 keeps the same snap`,
        reopened.peekHeight === 330 &&
          reopened.height === 430 &&
          getImmersiveSessionLayoutHeight() === 844,
        `peek=${reopened.peekHeight} sheet=${reopened.height}`
      ) && ok;
  }

  const keyboardPeeks: number[] = [];
  for (let i = 0; i < 5; i += 1) {
    const opened = resolveWithSession({
      layoutHeight: 340 - i * 20,
      usableHeight: 400,
      composerBottomReserve: 80,
      keyboardOpen: true,
    });
    const restored = resolveWithSession({
      layoutHeight: 320 - i * 20,
      usableHeight: 760,
      composerBottomReserve: 80,
      keyboardOpen: false,
    });
    keyboardPeeks.push(opened.peekHeight);
    ok =
      pass(
        `Keyboard cycle ${i + 1}/5 restores the exact closed snap`,
        opened.peekHeight === afterComposerMeasured.peekHeight &&
          restored.peekHeight === 330 &&
          restored.height === 430 &&
          getImmersiveSessionLayoutHeight() === 844,
        `keyboardPeek=${opened.peekHeight} closedPeek=${restored.peekHeight}`
      ) && ok;
  }

  ok =
    pass(
      "Five closed reopens and five keyboard cycles stay on the frozen session",
      closedReopenPeeks.every((peek) => peek === 330) &&
        closedReopenSheets.every((height) => height === 430) &&
        keyboardPeeks.every((peek) => peek === afterComposerMeasured.peekHeight),
      `closed=${closedReopenPeeks.join(",")} keyboard=${keyboardPeeks.join(",")}`
    ) && ok;

  captureImmersiveSessionLayoutHeight(400, false);
  ok =
    pass(
      "A later shrunken closed sample cannot replace the session",
      getImmersiveSessionLayoutHeight() === 844,
      `session=${getImmersiveSessionLayoutHeight()}`
    ) && ok;

  clearImmersiveSessionLayoutHeight();
  ok =
    pass(
      "Session layout clears only when the immersive viewer session ends",
      getImmersiveSessionLayoutHeight() == null && getImmersiveSessionPeekHeight() == null,
      `session=${getImmersiveSessionLayoutHeight()}`
    ) && ok;

  return ok;
}

main();
