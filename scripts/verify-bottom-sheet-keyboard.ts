/**
 * iOS sheet frame must follow the visual viewport and must not add the keyboard height twice.
 * Run: npx tsx scripts/verify-bottom-sheet-keyboard.ts
 */
import assert from "node:assert/strict";
import { resolveBottomSheetWebFrame } from "../lib/bottom-sheet-web-frame";
import {
  OVERLAY_BOTTOM_SAFETY_MARGIN_PX,
  type SafariVisualViewportSnapshot,
} from "../lib/safari-visual-viewport";

function snapshot(partial: Partial<SafariVisualViewportSnapshot>): SafariVisualViewportSnapshot {
  const base: SafariVisualViewportSnapshot = {
    layoutHeight: 844,
    offsetTop: 0,
    visualHeight: 844,
    bottomChrome: 0,
    envSafeAreaBottom: 34,
    envSafeAreaTop: 47,
    sheetInset: 34 + OVERLAY_BOTTOM_SAFETY_MARGIN_PX,
    overlayTop: 0,
    overlayHeight: 844,
  };
  const next = { ...base, ...partial };
  next.overlayTop = next.offsetTop;
  next.overlayHeight = next.visualHeight;
  next.sheetInset = next.envSafeAreaBottom + next.bottomChrome + OVERLAY_BOTTOM_SAFETY_MARGIN_PX;
  return next;
}

const keyboard = snapshot({
  offsetTop: 52,
  visualHeight: 360,
  bottomChrome: 432,
  envSafeAreaBottom: 0,
});
const pinnedKeyboard = resolveBottomSheetWebFrame({
  snapshot: keyboard,
  pinToVisualViewport: true,
  contentSized: false,
  snapRatio: 0.68,
  maxRatio: 0.88,
});

assert.equal(pinnedKeyboard.overlayTop, 52);
assert.equal(pinnedKeyboard.overlayHeight, 360);
assert.equal(pinnedKeyboard.marginBottom, OVERLAY_BOTTOM_SAFETY_MARGIN_PX);
assert.ok(pinnedKeyboard.marginBottom < keyboard.bottomChrome);
assert.ok(pinnedKeyboard.maxHeightPx <= pinnedKeyboard.overlayHeight);
assert.ok(pinnedKeyboard.snapHeightPx <= pinnedKeyboard.maxHeightPx);
assert.ok(!String(pinnedKeyboard.maxHeightPx).includes("dvh"));

const closed = snapshot({ visualHeight: 800, bottomChrome: 0, envSafeAreaBottom: 34 });
const pinnedClosed = resolveBottomSheetWebFrame({
  snapshot: closed,
  pinToVisualViewport: true,
  contentSized: false,
  snapRatio: 0.68,
  maxRatio: 0.88,
});
assert.equal(pinnedClosed.overlayTop, 0);
assert.equal(pinnedClosed.marginBottom, 34 + OVERLAY_BOTTOM_SAFETY_MARGIN_PX);
assert.equal(pinnedClosed.marginBottom, closed.envSafeAreaBottom + OVERLAY_BOTTOM_SAFETY_MARGIN_PX);
assert.ok(pinnedClosed.snapHeightPx <= pinnedClosed.maxHeightPx);

const unpinned = resolveBottomSheetWebFrame({
  snapshot: keyboard,
  pinToVisualViewport: false,
  contentSized: false,
  snapRatio: 0.68,
  maxRatio: 0.88,
});
assert.equal(unpinned.pinToVisualViewport, false);
assert.equal(unpinned.marginBottom, keyboard.sheetInset);

console.log("PASS  keyboard height is not added inside the visible viewport");
console.log("PASS  closed sheet keeps the measured safe-area inset");
console.log("PASS  snap height stays within the visible viewport");
console.log("\n3/3 bottom sheet keyboard frame checks passed.");
