#!/usr/bin/env node
/**
 * Regression: iOS Safari comment input must not trigger horizontal zoom/pan drift.
 *
 * Usage:
 *   node scripts/verify-comments-input-zoom.mjs
 *
 * Requires dist/ (npm run build:web).
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

function verifyStaticFix() {
  let ok = true;
  const postComments = readSource("components/PostCommentsSheet.tsx");
  const styles = readSource("lib/web-document-styles.js");
  const lock = readSource("lib/web-modal-scroll-lock.ts");
  const restore = readSource("lib/web-horizontal-scroll-restore.ts");
  const sheet = readSource("components/CommentsBottomSheet.tsx");
  const diag = readSource("lib/comments-input-zoom-diagnostics.ts");

  ok =
    pass(
      "PostCommentsSheet web composer fontSize is 16px",
      /fontSize:\s*Platform\.OS\s*===\s*"web"\s*\?\s*16/.test(postComments)
    ) && ok;
  ok =
    pass(
      "PostCommentsSheet marks comment input for CSS/diagnostics",
      postComments.includes('"data-frennix-comment-input": "true"')
    ) && ok;
  ok =
    pass(
      "PostCommentsSheet logs zoom snapshots on focus/blur/close",
      postComments.includes('logCommentsInputZoomSnapshot("before-focus")') &&
        postComments.includes('logCommentsInputZoomSnapshot("after-focus")') &&
        postComments.includes('logCommentsInputZoomSnapshot("after-comments-close")')
    ) && ok;
  ok =
    pass(
      "Global CSS enforces 16px on comment sheet inputs",
      styles.includes("[data-frennix-comments-sheet") && styles.includes("font-size: 16px")
    ) && ok;
  ok =
    pass(
      "Global CSS forbids transform/zoom shrink on comment inputs",
      styles.includes("transform: none") && styles.includes("zoom: normal")
    ) && ok;
  ok =
    pass(
      "App shell has overflow-x hidden + max-width 100%",
      styles.includes("#app-root-shell") &&
        styles.includes("overflow-x: hidden") &&
        styles.includes("max-width: 100%")
    ) && ok;
  ok =
    pass(
      "Comments sheet overlay uses width 100% not 100vw",
      sheet.includes('width: "100%"') && !sheet.includes('width: "100vw"')
    ) && ok;
  ok =
    pass(
      "Horizontal restore resets scrollX without using visualViewport.offsetLeft",
      restore.includes("Never use visualViewport.offsetLeft") &&
        restore.includes("window.scrollTo(0, preservedScrollY)") &&
        !/scrollTo\([^)]*offsetLeft/.test(restore)
    ) && ok;
  ok =
    pass(
      "Modal unlock restores horizontal scroll position",
      lock.includes("restoreWebHorizontalScrollPosition")
    ) && ok;
  ok =
    pass(
      "Diagnostics capture vv scale/offset and focused font-size",
      diag.includes("focusedFontSize") && diag.includes("vvScale") && diag.includes("vvOffsetLeft")
    ) && ok;
  ok =
    pass(
      "Feed scroll list still uses pan-y touch-action",
      styles.includes("#feed-scroll-list") && styles.includes("touch-action: pan-y")
    ) && ok;
  ok =
    pass(
      "Scroll lock does not mutate feed touchAction",
      !lock.includes('feed.style.touchAction = "none"')
    ) && ok;
  ok =
    pass(
      "Comment options z-index preserved above comments sheet",
      readSource("lib/overlay-z-index.ts").includes("commentOptions: 100000") &&
        readSource("lib/overlay-z-index.ts").includes("commentsSheet: 99998")
    ) && ok;

  return ok;
}

function verifyProductionBundle() {
  if (!fs.existsSync(path.join(DIST, "index.html"))) {
    pass("dist/index.html exists (run npm run build:web)", false);
    return false;
  }

  const html = fs.readFileSync(path.join(DIST, "index.html"), "utf8");
  const scrollCss = html.match(/<style id="frennix-web-scroll">([\s\S]*?)<\/style>/)?.[1] ?? "";
  const bundleMatch = html.match(/index-[a-f0-9]+\.js/);
  let ok = true;

  ok =
    pass(
      "Built HTML injects comment input 16px CSS",
      scrollCss.includes("font-size: 16px") && scrollCss.includes("data-frennix-comment-input")
    ) && ok;
  ok =
    pass(
      "Built HTML injects app shell overflow-x guard",
      scrollCss.includes("overflow-x: hidden") && scrollCss.includes("#app-root-shell")
    ) && ok;

  if (bundleMatch) {
    const bundlePath = path.join(DIST, "_expo/static/js/web", bundleMatch[0]);
    const bundle = fs.readFileSync(bundlePath, "utf8");
    ok = pass("Bundle includes comment input marker", bundle.includes("frennix-comment-input")) && ok;
    ok =
      pass(
        "Bundle includes horizontal scroll restore",
        bundle.includes("restoreWebHorizontalScrollPosition") || bundle.includes("scrollLeft = 0")
      ) && ok;
    ok = pass("Bundle includes zoom diagnostics hook", bundle.includes("FRENNIX_COMMENTS_INPUT_ZOOM_DIAG")) && ok;
  } else {
    ok = pass("Production bundle referenced in index.html", false) && ok;
  }

  return ok;
}

function main() {
  console.log("verify-comments-input-zoom\n");
  const staticOk = verifyStaticFix();
  console.log("");
  const bundleOk = verifyProductionBundle();
  console.log("");
  const ok = staticOk && bundleOk;
  console.log(ok ? "All checks passed." : "Some checks failed.");
  process.exit(ok ? 0 : 1);
}

main();
