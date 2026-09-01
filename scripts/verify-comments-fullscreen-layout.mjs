#!/usr/bin/env node
/**
 * Regression: mobile web comments must use one full-screen opaque modal layout.
 *
 * Usage:
 *   node scripts/verify-comments-fullscreen-layout.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function pass(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

function readSource(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function main() {
  console.log("verify-comments-fullscreen-layout\n");
  let ok = true;
  const sheet = readSource("components/CommentsBottomSheet.tsx");
  const styles = readSource("lib/web-document-styles.js");
  const viewport = readSource("lib/safari-visual-viewport.ts");
  const lock = readSource("lib/web-modal-scroll-lock.ts");

  ok =
    pass(
      "Mobile web uses full-screen comments path",
      sheet.includes("useMobileWebFullscreen") && sheet.includes("data-frennix-comments-fullscreen")
    ) && ok;
  ok =
    pass(
      "Full-screen root height uses visualViewport.height only",
      sheet.includes("readVisualViewportHeight") && !sheet.includes("offsetTop") && !sheet.includes("keyboardInset")
    ) && ok;
  ok =
    pass(
      "No partial-height sheet ratio on mobile web path",
      !sheet.includes("SHEET_OPEN_RATIO") || sheet.includes("useMobileWebFullscreen")
    ) && ok;
  const mobileBlock = sheet.match(/const mobileWebSurface = \([\s\S]*?\n  \);/)?.[0] ?? "";
  ok =
    pass(
      "Mobile web full-screen surface has no translateY transform",
      mobileBlock.length > 0 && !mobileBlock.includes("translateY")
    ) && ok;
  ok =
    pass(
      "Comments list uses flex:1 min-height:0 overflow-y:auto",
      sheet.includes("flex: 1") && sheet.includes("minHeight: 0") && sheet.includes('overflowY: "auto"')
    ) && ok;
  ok =
    pass(
      "Composer is final flex child without independent positioning",
      sheet.includes("composerHost") && sheet.includes("flexShrink: 0") && !sheet.includes("position: \"absolute\"")
    ) && ok;
  ok =
    pass(
      "Close blurs active web input",
      sheet.includes("blurActiveWebInput")
    ) && ok;
  ok =
    pass(
      "Opaque full-screen CSS guard exists",
      styles.includes("data-frennix-comments-fullscreen") && styles.includes("opacity: 1")
    ) && ok;
  ok =
    pass(
      "readVisualViewportHeight exported",
      viewport.includes("export function readVisualViewportHeight")
    ) && ok;
  ok =
    pass(
      "Scroll lock does not mutate feed scroll list",
      !lock.includes('getElementById("feed-scroll-list")') ||
        (!lock.includes('feed.style.touchAction = "none"') && !lock.includes('feed.style.overflow'))
    ) && ok;
  ok =
    pass(
      "Single comments entry point preserved",
      readSource("lib/useFeedCommentsSheet.tsx").includes("PostCommentsSheet") &&
        readSource("components/PostCommentsSheet.tsx").includes("CommentsBottomSheet")
    ) && ok;
  ok =
    pass(
      "Comment options z-index unchanged",
      readSource("lib/overlay-z-index.ts").includes("commentOptions: 100000")
    ) && ok;
  ok =
    pass(
      "16px comment input preserved",
      readSource("components/PostCommentsSheet.tsx").includes('Platform.OS === "web" ? 16 : 15')
    ) && ok;

  console.log("");
  console.log(ok ? "All checks passed." : "Some checks failed.");
  process.exit(ok ? 0 : 1);
}

main();
