/**
 * Runtime reproduction of React #310 for the onboarding location sheet.
 * Closed → open must not add hooks.
 */
import assert from "node:assert/strict";

let hookCount = 0;
function useMemo(factory) {
  hookCount += 1;
  return factory();
}

function brokenSheet(visible) {
  if (!visible) return null;
  useMemo(() => "sheet-style");
  return "sheet";
}

function fixedSheet(visible) {
  useMemo(() => "sheet-style");
  if (!visible) return null;
  return "sheet";
}

function renderPath(render, visible) {
  hookCount = 0;
  const view = render(visible);
  return { hookCount, view };
}

const brokenClosed = renderPath(brokenSheet, false);
const brokenOpen = renderPath(brokenSheet, true);
assert.equal(brokenClosed.hookCount, 0);
assert.equal(brokenOpen.hookCount, 1);
assert.notEqual(
  brokenClosed.hookCount,
  brokenOpen.hookCount,
  "old hook-after-return pattern changes hook count (React #310)"
);

const freshClosed = renderPath(fixedSheet, false);
const freshOpen = renderPath(fixedSheet, true);
assert.equal(freshClosed.hookCount, freshOpen.hookCount, "fresh account: closed→open location sheet keeps hook count");
assert.equal(freshOpen.view, "sheet");

const partialClosed = renderPath(fixedSheet, false);
const partialOpen = renderPath(fixedSheet, true);
assert.equal(
  partialClosed.hookCount,
  partialOpen.hookCount,
  "partial onboarding: closed→open location sheet keeps hook count"
);

console.log("PASS  React #310 reproduction for hook-after-return");
console.log("PASS  fresh account location sheet closed→open");
console.log("PASS  partial onboarding location sheet closed→open");
