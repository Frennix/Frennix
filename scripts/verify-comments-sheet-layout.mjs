#!/usr/bin/env node
/**
 * Regression: iPhone comments sheet must stay a solid modal layer with stable keyboard layout.
 *
 * Usage:
 *   node scripts/verify-comments-sheet-layout.mjs
 *
 * Requires dist/ for bundle checks (npm run build:web).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");

function pass(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

function readSource(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function findMainBundle() {
  const html = fs.readFileSync(path.join(DIST, "index.html"), "utf8");
  const match = html.match(/index-[a-f0-9]+\.js/);
  if (!match) throw new Error("Could not find main bundle in dist/index.html");
  return path.join(DIST, "_expo/static/js/web", match[0]);
}

function verifyStaticFix() {
  let ok = true;
  const sheet = readSource("components/CommentsBottomSheet.tsx");
  const lock = readSource("lib/web-modal-scroll-lock.ts");
  const composer = readSource("components/PostCommentsSheet.tsx");

  ok =
    pass(
      "overlay tracks visual viewport top and height",
      sheet.includes("top: overlayTop") && sheet.includes("height: overlayHeight")
    ) && ok;
  ok =
    pass(
      "sheet uses absolute bottom anchoring on web",
      sheet.includes("sheetWeb") && sheet.includes('position: "absolute"') && sheet.includes("bottom: 0")
    ) && ok;
  ok =
    pass(
      "baseline height captured on open for stable closed sheet",
      sheet.includes("baselineVisualHeightRef") && sheet.includes("computeClosedSheetHeight")
    ) && ok;
  ok =
    pass(
      "keyboard open expands sheet to full overlay height",
      sheet.includes("isKeyboardOpen") && sheet.includes("keyboardOpen && overlayHeight")
    ) && ok;
  ok =
    pass(
      "comments list uses pan-y and overscroll contain",
      sheet.includes('touchAction: "pan-y"') && sheet.includes('overscrollBehavior: "contain"')
    ) && ok;
  ok =
    pass(
      "backdrop and non-scroll areas use touch-action none",
      sheet.includes('touchAction: "none"') && sheet.includes("backdropPressable")
    ) && ok;
  ok =
    pass(
      "composer safe area padding on host not sheet root",
      sheet.includes("composerSafeBottom") && sheet.includes("paddingBottom: composerSafeBottom")
    ) && ok;
  ok =
    pass(
      "viewport listeners removed when sheet closes",
      sheet.includes("subscribeSafariVisualViewport") && sheet.includes("if (!visible")
    ) && ok;
  ok =
    pass(
      "scroll lock sets body/html overflow hidden not feed",
      lock.includes('document.body.style.overflow = "hidden"') &&
        !lock.includes('feed.style.touchAction = "none"') &&
        !lock.includes('feed.style.overflow = "hidden"')
    ) && ok;
  ok =
    pass(
      "composer input background transparent on web",
      composer.includes('backgroundColor: "transparent"') && composer.includes("borderWidth: 0")
    ) && ok;
  ok =
    pass(
      "portal unmounts when hidden",
      sheet.includes("if (!visible) return null")
    ) && ok;

  return ok;
}

function verifyBundle() {
  if (!fs.existsSync(path.join(DIST, "index.html"))) {
    console.log("SKIP  bundle checks — run npm run build:web");
    return true;
  }

  let ok = true;
  const bundle = fs.readFileSync(findMainBundle(), "utf8");
  ok = pass("bundle includes comments sheet portal marker", bundle.includes("frennix-comments-sheet")) && ok;
  ok = pass("bundle includes overscroll contain on comments list", bundle.includes("overscrollBehavior")) && ok;
  ok = pass("bundle locks document overflow on modal open", bundle.includes('overflow="hidden"') || bundle.includes("overflow:hidden")) && ok;
  return ok;
}

function main() {
  console.log("=== Comments sheet layout verification ===\n");
  const staticOk = verifyStaticFix();
  const bundleOk = verifyBundle();
  const allOk = staticOk && bundleOk;
  console.log(`\nverify-comments-sheet-layout: ${allOk ? "PASS" : "FAIL"}`);
  if (!allOk) process.exitCode = 1;
}

main();
